import { createHash } from 'node:crypto';

// This is a source evidence reader, not a Java interpreter. Offsets always refer
// to the original source, and no imports, calls, constants, or branches execute.
const CONDITION_TYPE = /(?:Requirements?|Conditions?)$|^Zone$/;
const ITEM_TYPE = /^(?:ItemRequirement|TeleportItemRequirement|FollowerItemRequirement)$/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const SIMPLE_STEP_TYPES = new Set(['NpcStep', 'ObjectStep', 'DetailedQuestStep']);
const LOCATION_MUTATORS = new Set(['setWorldPoint', 'setWorldPointVarp']);
const KNOWN_CALLS = new Set([
  'addStep', 'addSteps', 'setDefaultStep', 'setLockingCondition', 'setBlocker',
  'addDialogStep', 'addDialogSteps', 'addDialogStepsWithMatcher', 'addDialogStepWithMatcher',
  'addDialogStepWithExclusion', 'addDialogStepWithLine', 'addSubSteps', 'addSubStep',
  'addAlternateNpcs', 'addAlternateObjects', 'addAlternateObject', 'addAlternateNpc',
  'addIcon', 'addTileMarker', 'addWidgetHighlight', 'addWidgetHighlightWithItemId',
  'setText', 'addText', 'setLinePoints', 'setHighlightZone', 'setMaxRoamRange',
  'setAllowInCutscene', 'setHideRequirements', 'setOverlayText', 'setQuestHelper',
  'setTooltip', 'isNotConsumed', 'addAlternates', 'setExclusiveToOneItemType',
  'setEquip', 'setHighlightInInventory', 'setQuantity', 'setDisplayItemId',
  'setAlsoCheckBank', 'setHideCondition', 'setAdditionalText', 'setOptional',
  'setRecommended', 'setRequirements', 'setLockingStep', 'setDisplayCondition',
]);

function lex(source, issue) {
  const tokens = [];
  const comments = [];
  let offset = 0;
  let line = 1;
  const advance = (end) => {
    line += (source.slice(offset, end).match(/\n/g) || []).length;
    offset = end;
  };
  while (offset < source.length) {
    if (/\s/.test(source[offset])) { advance(offset + 1); continue; }
    const start = offset;
    const sourceLine = line;
    if (source.startsWith('//', offset)) {
      const end = source.indexOf('\n', offset + 2);
      advance(end < 0 ? source.length : end);
      comments.push({ text: source.slice(start, offset), start, line: sourceLine });
      continue;
    }
    if (source.startsWith('/*', offset)) {
      const end = source.indexOf('*/', offset + 2);
      advance(end < 0 ? source.length : end + 2);
      comments.push({ text: source.slice(start, offset), start, line: sourceLine });
      if (end < 0) issue('MALFORMED_COMMENT', sourceLine, source.slice(start), 'Unclosed block comment.');
      continue;
    }
    let kind = 'punctuation';
    if (source.startsWith('"""', offset)) {
      kind = 'textBlock';
      let end = offset + 3;
      while (end < source.length && !source.startsWith('"""', end)) {
        end += source[end] === '\\' ? 2 : 1;
      }
      if (end >= source.length) issue('MALFORMED_STRING', sourceLine, source.slice(start), 'Unclosed Java text block.');
      advance(Math.min(source.length, end + 3));
      issue('UNRESOLVED_TEXT_BLOCK', sourceLine, source.slice(start, offset), 'Java text block retained without interpreting indentation or escapes.');
    } else if (source[offset] === '"' || source[offset] === "'") {
      kind = source[offset] === '"' ? 'string' : 'character';
      const quote = source[offset];
      let end = offset + 1;
      while (end < source.length && source[end] !== quote && source[end] !== '\n') {
        end += source[end] === '\\' ? 2 : 1;
      }
      if (source[end] !== quote) issue('MALFORMED_STRING', sourceLine, source.slice(start, end), 'Unclosed Java literal.');
      advance(Math.min(source.length, source[end] === quote ? end + 1 : end));
    } else {
      const match = /^[A-Za-z_$][\w$]*|^(?:\d[\w.]*)/.exec(source.slice(offset));
      if (match) {
        kind = IDENTIFIER.test(match[0]) ? 'identifier' : 'number';
        advance(offset + match[0].length);
      } else {
        const operator = /^(?:==|!=|<=|>=|\+=|-=|\*=|\/=|&&|\|\||->|::|\+\+|--)/.exec(source.slice(offset));
        advance(offset + (operator ? operator[0].length : 1));
      }
    }
    tokens.push({ value: source.slice(start, offset), kind, start, end: offset, line: sourceLine });
  }
  const stack = [];
  const pairs = new Map();
  const closing = { ')': '(', ']': '[', '}': '{' };
  tokens.forEach((token, index) => {
    if (['(', '[', '{'].includes(token.value)) stack.push(index);
    else if (Object.hasOwn(closing, token.value)) {
      const open = stack.at(-1);
      if (open !== undefined && tokens[open].value === closing[token.value]) {
        stack.pop(); pairs.set(open, index); pairs.set(index, open);
      } else issue('UNBALANCED_DELIMITER', token.line, token.value, 'Unexpected closing delimiter; nearby evidence may be incomplete.');
    }
  });
  for (const index of stack) issue('UNBALANCED_DELIMITER', tokens[index].line, tokens[index].value, 'Unclosed delimiter; nearby evidence may be incomplete.');
  return { tokens, comments, pairs };
}

function literalInteger(expression) {
  if (!/^[+-]?\s*(?:0|[1-9][\d_]*)$/.test(expression)) return null;
  const value = Number(expression.replace(/[\s_]/g, ''));
  return Number.isSafeInteger(value) ? value : null;
}

function literalString(tokens) {
  if (tokens.length !== 1 || tokens[0].kind !== 'string' || !tokens[0].value.endsWith('"')) return null;
  const raw = tokens[0].value.slice(1, -1);
  // Octal and Java Unicode preprocessing are deliberately not approximated.
  if (/\\(?:u|[0-7])/.test(raw) || /\\[^btnfr"'\\]/.test(raw)) return null;
  const replacements = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', "'": "'", '\\': '\\' };
  return raw.replace(/\\([btnfr"'\\])/g, (_, escaped) => replacements[escaped]);
}

/** Extract review candidates only. Literal locations do not prove accessibility. */
export function extractQuestHelperFile({ path, content }) {
  if (typeof path !== 'string' || typeof content !== 'string') throw new TypeError('path and content must be strings');
  const issues = [];
  const issue = (code, sourceLine, expression, message) => issues.push({ code, sourceLine, expression, message });
  const { tokens, comments, pairs } = lex(content, issue);
  const raw = (start, end) => start < end ? content.slice(tokens[start].start, tokens[end - 1].end).trim() : '';
  const value = (index) => tokens[index]?.value;
  const parts = (open) => {
    const close = pairs.get(open);
    if (close === undefined) return [];
    const ranges = [];
    let start = open + 1;
    for (let i = start; i < close; i++) {
      if (['(', '[', '{'].includes(value(i)) && pairs.has(i)) { i = pairs.get(i); continue; }
      if (value(i) === ',') { ranges.push([start, i]); start = i + 1; }
    }
    if (start < close) ranges.push([start, close]);
    return ranges;
  };
  const callAt = (methodIndex) => {
    const open = methodIndex + 1;
    if (value(open) !== '(' || !pairs.has(open)) return null;
    const close = pairs.get(open);
    return { method: value(methodIndex), sourceLine: tokens[methodIndex].line,
      expression: raw(methodIndex, close + 1), arguments: parts(open).map(([a, b]) => raw(a, b)), end: close + 1 };
  };
  const publicCall = ({ end, ...call }) => call;
  const assignedVariable = (start) => {
    if (value(start - 1) !== '=' || tokens[start - 2]?.kind !== 'identifier') return null;
    return value(start - 2);
  };
  const result = {
    className: null, sourcePath: path.replaceAll('\\', '/'),
    sourceSha256: createHash('sha256').update(content, 'utf8').digest('hex'),
    notices: comments.filter((comment) => /copyright|redistribution|SPDX-License-Identifier/i.test(comment.text)).map((comment) => comment.text),
    worldPoints: [], steps: [], itemRequirements: [], conditions: [], conditionalSteps: [],
    progressSteps: [], panels: [], issues, coverage: 'STATIC_PARTIAL',
  };
  const classIndex = tokens.findIndex((token) => token.value === 'class');
  if (classIndex >= 0) result.className = value(classIndex + 1) || null;
  if (/\\u+[0-9a-fA-F]{4}/.test(content)) issue('JAVA_UNICODE_ESCAPE', 1, '', 'Java Unicode preprocessing is not evaluated; consult the original source.');

  // Track declared variable types so aliases/factory expressions are not lost.
  const declaredTypes = new Map();
  const pointVariables = new Set();
  const requirementLists = new Set();
  for (let i = 0; i < tokens.length - 1; i++) {
    if (value(i) === 'WorldPoint' && tokens[i + 1].kind === 'identifier' && value(i + 2) !== '(') pointVariables.add(value(i + 1));
    if (['List', 'ArrayList'].includes(value(i)) && value(i + 1) === '<' && CONDITION_TYPE.test(value(i + 2)) && value(i + 3) === '>' && tokens[i + 4]?.kind === 'identifier') requirementLists.add(value(i + 4));
    if (!(CONDITION_TYPE.test(value(i)) || /Step$/.test(value(i)) || value(i) === 'PanelDetails')) continue;
    if (tokens[i + 1].kind !== 'identifier' || value(i + 2) === '(') continue;
    declaredTypes.set(value(i + 1), value(i));
    let end = i + 2;
    while (end < tokens.length && ![';', '{', '}'].includes(value(end))) {
      if (['(', '['].includes(value(end)) && pairs.has(end)) { end = pairs.get(end) + 1; continue; }
      if (value(end) === ',' && tokens[end + 1]?.kind === 'identifier') declaredTypes.set(value(end + 1), value(i));
      end++;
    }
  }

  const constructors = [];
  for (let i = 0; i < tokens.length; i++) {
    if (value(i) !== 'new') continue;
    let typeEnd = i + 1;
    if (tokens[typeEnd]?.kind !== 'identifier') continue;
    while (value(typeEnd + 1) === '.' && tokens[typeEnd + 2]?.kind === 'identifier') typeEnd += 2;
    const kind = value(typeEnd);
    let open = typeEnd + 1;
    if (value(open) === '<') {
      let depth = 1;
      while (++open < tokens.length && depth) {
        if (value(open) === '<') depth++;
        if (value(open) === '>') depth--;
      }
      // The loop stops one token after the closing generic delimiter.
    }
    if (value(open) !== '(' || !pairs.has(open)) {
      if (kind === 'WorldPoint' || /Step$/.test(kind) || CONDITION_TYPE.test(kind) || kind === 'PanelDetails') {
        issue(value(open) === '[' ? 'UNRESOLVED_ARRAY_CREATION' : 'UNPARSED_CONSTRUCTOR', tokens[i].line,
          raw(i, Math.min(i + 12, tokens.length)), value(open) === '[' ? 'Array creation is retained without resolving elements or indexes.' : 'Constructor arguments could not be balanced.');
      }
      continue;
    }
    const close = pairs.get(open);
    const ranges = parts(open);
    let end = close + 1;
    const fluentCalls = [];
    while (value(end) === '.' && tokens[end + 1]?.kind === 'identifier') {
      const call = callAt(end + 1);
      if (!call) break;
      fluentCalls.push(publicCall(call)); end = call.end;
    }
    const constructor = { start: i, close, end, ranges, kind, variable: assignedVariable(i), sourceLine: tokens[i].line,
      expression: raw(i, end), arguments: ranges.map(([a, b]) => raw(a, b)), fluentCalls };
    constructors.push(constructor);
    if (value(end) === '{') issue('ANONYMOUS_CLASS', tokens[i].line, constructor.expression, 'Anonymous class behavior is not interpreted.');
  }

  const pointsByStart = new Map();
  for (const ctor of constructors.filter(({ kind }) => kind === 'WorldPoint')) {
    const coords = ctor.ranges.map(([a, b]) => literalInteger(tokens.slice(a, b).map((token) => token.value).join('')));
    if (coords.length === 3 && coords.every((coordinate) => coordinate !== null)) {
      const point = { x: coords[0], y: coords[1], plane: coords[2], line: ctor.sourceLine, expression: raw(ctor.start, ctor.close + 1) };
      result.worldPoints.push(point);
      if (ctor.end === ctor.close + 1) pointsByStart.set(ctor.start, point);
      else issue('UNRESOLVED_WORLD_POINT', ctor.sourceLine, ctor.expression, 'The literal base point is retained, but a following transform prevents resolving the destination.');
    } else issue('UNRESOLVED_WORLD_POINT', ctor.sourceLine, ctor.expression, 'Coordinates or a following transform are not three direct integer literals.');
  }

  const records = [];
  const conditionKind = (kind) => CONDITION_TYPE.test(kind) || ['Conditions', 'Zone'].includes(kind);
  const addRecord = (record, collection, start) => { collection.push(record); records.push({ record, start }); };
  for (const ctor of constructors) {
    const { kind, variable, sourceLine, expression, arguments: args, ranges, start } = ctor;
    const base = { kind, variable, sourceLine, expression, arguments: args, followupCalls: [...ctor.fluentCalls] };
    if (kind === 'WorldPoint') continue;
    if (kind === 'ConditionalStep' || kind === 'ReorderableConditionalStep') {
      addRecord({ ...base, defaultStepExpression: args[1] ?? null, branches: [] }, result.conditionalSteps, start);
      if (args.length !== 2) issue('CONDITIONAL_OVERLOAD', sourceLine, expression, 'Conditional constructor overload requires review; raw arguments are preserved.');
    } else if (/Step$/.test(kind) || /Step$/.test(declaredTypes.get(variable) || '')) {
      let textIndex = -1;
      let worldPoint = null;
      const directPoints = ranges.map(([a, b], index) => ({ point: pointsByStart.get(a), start: a, end: b, index }))
        .filter(({ point, start: pointStart, end: pointEnd }) => point && constructors.some((candidate) => candidate.start === pointStart && candidate.end === pointEnd));
      if (directPoints.length === 1) worldPoint = directPoints[0].point;
      const isLiteralText = (index) => ranges[index] && literalString(tokens.slice(...ranges[index])) !== null;
      const isPointArgument = (index) => ranges[index] && (pointVariables.has(args[index]) || constructors.some((candidate) => candidate.kind === 'WorldPoint' && candidate.start === ranges[index][0]));
      const isRequirementList = (argument) => requirementLists.has(argument) || /^(?:List\s*\.\s*of|Arrays\s*\.\s*asList|Collections\s*\.\s*(?:singletonList|emptyList))\s*\(/.test(argument);
      if (kind === 'DetailedQuestStep') textIndex = isPointArgument(1) ? 2 : isLiteralText(1) ? 1 : isLiteralText(2) ? 2 : -1;
      else if (kind === 'NpcStep' || kind === 'ObjectStep') {
        // NpcStep may have both an NPC name and instruction string. The name
        // precedes its point; never select that name as the instruction.
        if (kind === 'NpcStep' && isPointArgument(3)) textIndex = 4;
        else if (kind === 'NpcStep' && isLiteralText(2) && args.length >= 5 && !['true', 'false'].includes(args[3]) && !declaredTypes.has(args[3]) && !isRequirementList(args[3])) {
          issue('AMBIGUOUS_STEP_OVERLOAD', sourceLine, expression, 'NPC name and instruction overload cannot be distinguished safely; consult raw arguments.');
        }
        else if (isPointArgument(2)) textIndex = 3;
        else if (isLiteralText(2)) textIndex = 2;
        else if (isLiteralText(3)) textIndex = 3;
        else if (args.length === 3) textIndex = 2;
      } else {
        const candidates = ranges.map((_, index) => index).filter(isLiteralText);
        if (candidates.length === 1) textIndex = candidates[0];
      }
      const text = ranges[textIndex] ? literalString(tokens.slice(...ranges[textIndex])) : null;
      const trailingArguments = textIndex < 0 ? [] : args.slice(textIndex + 1).filter((arg) => !['true', 'false'].includes(arg));
      const hasSeparateRecommendedList = SIMPLE_STEP_TYPES.has(kind) && trailingArguments.length === 2 && trailingArguments.every(isRequirementList);
      const requirements = hasSeparateRecommendedList ? trailingArguments.slice(0, 1) : trailingArguments;
      const recommended = hasSeparateRecommendedList ? trailingArguments.slice(1) : [];
      addRecord({ ...base, text, textExpression: args[textIndex] ?? null, worldPoint, constructorWorldPoint: worldPoint, requirementExpressions: requirements, recommendedRequirementExpressions: recommended, dialogue: [] }, result.steps, start);
      if (!SIMPLE_STEP_TYPES.has(kind)) issue('CUSTOM_STEP_SEMANTICS', sourceLine, expression, 'Custom step constructor semantics require review; literal candidates are not a resolved route.');
      if (text === null) issue('UNRESOLVED_STEP_TEXT', sourceLine, expression, 'No unambiguous literal step text was found.');
      if (directPoints.length > 1) issue('AMBIGUOUS_STEP_LOCATION', sourceLine, expression, 'Multiple direct points are preserved; no single destination was selected.');
      if (worldPoint === null && constructors.some((candidate) => candidate.kind === 'WorldPoint' && candidate.start > start && candidate.start < ctor.close)) {
        issue('NESTED_STEP_LOCATIONS', sourceLine, expression, 'Nested points may describe zones or alternatives and are not a single step destination.');
      } else if (worldPoint === null && SIMPLE_STEP_TYPES.has(kind) && textIndex > (kind === 'DetailedQuestStep' ? 1 : 2)) {
        issue('UNRESOLVED_STEP_LOCATION', sourceLine, args[textIndex - 1], 'Location argument is retained without resolving a named or dynamic point.');
      }
    } else if (ITEM_TYPE.test(kind)) {
      // Only the documented ItemRequirement overloads have normalized fields.
      const exactItem = kind === 'ItemRequirement';
      const shift = exactItem && ['true', 'false'].includes(args[0]) ? 1 : 0;
      const name = ranges[shift] ? literalString(tokens.slice(...ranges[shift])) : null;
      const quantity = exactItem && args[shift + 2] !== undefined ? literalInteger(args[shift + 2]) : null;
      const mustBeEquipped = exactItem && ['true', 'false'].includes(args[shift + 3]) ? args[shift + 3] === 'true' : null;
      addRecord({ ...base, name, quantity, quantityExpression: exactItem ? args[shift + 2] ?? null : null,
        mustBeEquipped, idExpression: exactItem ? args[shift + 1] ?? null : null, modifiers: [], alternates: [] }, result.itemRequirements, start);
      if (!exactItem || name === null || (args[shift + 2] !== undefined && quantity === null) || (args[shift + 3] !== undefined && mustBeEquipped === null)) {
        issue('UNRESOLVED_ITEM_REQUIREMENT', sourceLine, expression, 'Dynamic values or an item subclass overload require review; raw arguments are preserved.');
      }
    } else if (conditionKind(kind)) {
      addRecord(base, result.conditions, start);
    } else if (kind === 'PanelDetails') {
      const title = ranges[0] ? literalString(tokens.slice(...ranges[0])) : null;
      let stepExpressions = [];
      const stepRange = ranges[1];
      if (stepRange) {
        const [a, b] = stepRange;
        if (['List.of', 'Arrays.asList', 'Collections.singletonList'].includes(raw(a, a + 3)) && value(a + 3) === '(' && pairs.get(a + 3) === b - 1) {
          stepExpressions = parts(a + 3).map(([from, to]) => raw(from, to));
        } else issue('UNRESOLVED_PANEL_STEPS', sourceLine, args[1], 'Panel step expression is retained without resolving a collection or variable.');
      }
      addRecord({ ...base, title, stepExpressions }, result.panels, start);
    } else if (conditionKind(declaredTypes.get(variable) || '')) {
      addRecord(base, result.conditions, start);
      issue('CUSTOM_CONDITION_SEMANTICS', sourceLine, expression, 'Declared requirement or zone uses a custom constructor; behavior is not interpreted.');
    } else if (!['ArrayList', 'HashMap', 'LinkedHashMap', 'TreeMap', 'HashSet', 'LinkedHashSet', 'ArrayDeque', 'EnumMap', 'EnumSet', 'String', 'StringBuilder', 'Color', 'QuestPointReward', 'ExperienceReward', 'ItemReward', 'UnlockReward'].includes(kind)) {
      issue('UNMODELED_CONSTRUCTOR', sourceLine, expression, 'Unclassified constructor is preserved for review; it may include custom helper behavior.');
    }
  }

  // Retain non-constructor assignments (logic factories, aliases, copies, etc.).
  for (let i = 1; i < tokens.length - 1; i++) {
    if (value(i) !== '=' || tokens[i - 1].kind !== 'identifier') continue;
    const variable = value(i - 1);
    const kind = declaredTypes.get(variable);
    if (!kind || records.some(({ start }) => start === i + 1)) continue;
    let end = i + 1;
    while (end < tokens.length && ![';', '}'].includes(value(end))) {
      if (['(', '[', '{'].includes(value(end)) && pairs.has(end)) end = pairs.get(end);
      end++;
    }
    const expression = raw(i + 1, end);
    const base = { kind, variable, sourceLine: tokens[i].line, expression, arguments: [], followupCalls: [] };
    if (ITEM_TYPE.test(kind)) addRecord({ ...base, name: null, quantity: null, quantityExpression: null, mustBeEquipped: null, idExpression: null, modifiers: [], alternates: [] }, result.itemRequirements, i + 1);
    else if (conditionKind(kind)) addRecord(base, result.conditions, i + 1);
    else if (/Step$/.test(kind)) addRecord({ ...base, text: null, textExpression: null, worldPoint: null, constructorWorldPoint: null, requirementExpressions: [], recommendedRequirementExpressions: [], dialogue: [] }, result.steps, i + 1);
    else if (kind === 'PanelDetails') addRecord({ ...base, title: null, stepExpressions: [] }, result.panels, i + 1);
    issue('UNRESOLVED_ASSIGNMENT', tokens[i].line, expression, 'Factory, alias, or dynamic assignment is retained without evaluation.');
  }
  records.sort((a, b) => a.start - b.start);
  const namedRecords = new Map();
  for (const entry of records) {
    if (!entry.record.variable) continue;
    const entries = namedRecords.get(entry.record.variable) || [];
    entries.push(entry); namedRecords.set(entry.record.variable, entries);
    if (entries.length > 1) issue('REASSIGNED_VARIABLE', entry.record.sourceLine, entry.record.variable, 'Multiple assignments or scopes share this name; associations require review.');
  }

  const mapVariables = new Set(['steps']);
  for (const ctor of constructors) {
    if (ctor.variable && /^(?:HashMap|TreeMap|LinkedHashMap)$/.test(ctor.kind) && /\bQuestStep\b/.test(ctor.expression)) mapVariables.add(ctor.variable);
  }
  for (let i = 0; i < tokens.length; i++) {
    if (value(i) !== '=') continue;
    let begin = i - 1;
    while (begin > 0 && ![';', '{', '}'].includes(value(begin - 1))) begin--;
    if (/\b(?:Map|HashMap|TreeMap|LinkedHashMap)\b[\s\S]*\bQuestStep\b/.test(raw(begin, i))) mapVariables.add(value(i - 1));
  }
  const locationMutations = new Map();
  for (let i = 1; i < tokens.length - 1; i++) {
    if (value(i) !== '.' || tokens[i - 1].kind !== 'identifier') continue;
    const receiver = value(i - 1);
    const call = callAt(i + 1);
    if (!call) continue;
    const entries = namedRecords.get(receiver);
    const entry = entries?.filter((candidate) => candidate.start < i).at(-1);
    const calls = [{ ...publicCall(call), expression: raw(i - 1, call.end) }];
    let chainEnd = call.end;
    while (value(chainEnd) === '.' && tokens[chainEnd + 1]?.kind === 'identifier') {
      const chained = callAt(chainEnd + 1);
      if (!chained) break;
      calls.push(publicCall(chained)); chainEnd = chained.end;
    }
    if (entry) entry.record.followupCalls.push(...calls);
    else if (entries || declaredTypes.has(receiver)) {
      issue('UNASSOCIATED_CALL', call.sourceLine, raw(i - 1, call.end), 'Call appears before a matching assignment, or its receiver cannot be associated safely.');
    }
    const mutations = calls.filter((candidate) => LOCATION_MUTATORS.has(candidate.method));
    if (mutations.length) locationMutations.set(receiver, [...(locationMutations.get(receiver) || []), ...mutations]);
    if (call.method === 'put' && mapVariables.has(receiver)) {
      result.progressSteps.push({ mapExpression: receiver, stateExpression: call.arguments[0] ?? null,
        stepExpression: call.arguments[1] ?? null, sourceLine: call.sourceLine, expression: raw(i - 1, call.end) });
      if (call.arguments.length !== 2) issue('UNRESOLVED_PROGRESS_STEP', call.sourceLine, raw(i - 1, call.end), 'Progress map call has an unexpected argument count.');
    }
  }

  for (const { record } of records) {
    if (Object.hasOwn(record, 'worldPoint')) {
      const mutations = [...(locationMutations.get(record.variable) || []), ...record.followupCalls.filter((call) => LOCATION_MUTATORS.has(call.method))];
      if (mutations.length) {
        record.worldPoint = null;
        record.locationMutationCalls = [...new Map(mutations.map((call) => [`${call.sourceLine}:${call.expression}`, call])).values()];
        issue('LOCATION_MUTATED', record.sourceLine, record.expression, 'Source mutates this step location; the constructor point is retained separately and is not a resolved destination.');
      }
    }
    for (const call of record.followupCalls) {
      if (!KNOWN_CALLS.has(call.method) && !LOCATION_MUTATORS.has(call.method)) issue('UNMODELED_CALL', call.sourceLine, call.expression, 'Follow-up call is preserved but its behavior is not interpreted.');
      if (record.branches && call.method === 'addStep') {
        record.branches.push({ order: record.branches.length, sourceLine: call.sourceLine,
          conditionExpression: call.arguments[0] ?? null, stepExpression: call.arguments[1] ?? null,
          arguments: call.arguments, expression: call.expression });
        if (call.arguments.length !== 2) issue('CONDITIONAL_BRANCH_OVERLOAD', call.sourceLine, call.expression, 'Extra or missing branch arguments require review.');
      }
      if (record.dialogue && /Dialog/.test(call.method)) {
        // Dialog calls may carry indices, matchers and exclusions. Keep all args.
        record.dialogue.push({ ...call, text: call.arguments.map((argument) => {
          const parsed = lex(argument, () => {}); return literalString(parsed.tokens);
        }).filter((text) => text !== null) });
      }
      if (record.modifiers) {
        record.modifiers.push(call);
        if (call.method === 'addAlternates') record.alternates.push(...call.arguments);
      }
    }
  }
  for (const collection of [result.steps, result.itemRequirements, result.conditions, result.conditionalSteps, result.panels]) {
    collection.sort((a, b) => a.sourceLine - b.sourceLine);
  }
  result.issues.sort((a, b) => a.sourceLine - b.sourceLine || a.code.localeCompare(b.code));
  return result;
}
