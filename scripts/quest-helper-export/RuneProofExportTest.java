package com.questhelper;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.questhelper.panel.PanelDetails;
import com.questhelper.questhelpers.BasicQuestHelper;
import com.questhelper.questhelpers.QuestHelper;
import com.questhelper.questinfo.QuestHelperQuest;
import com.questhelper.requirements.Requirement;
import com.questhelper.steps.ConditionalStep;
import com.questhelper.steps.QuestStep;
import net.runelite.api.coords.WorldPoint;
import com.questhelper.domain.AccountType;
import static org.mockito.Mockito.when;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.regex.Pattern;
import java.util.zip.GZIPOutputStream;

/** Export structural source evidence. Never evaluates branch requirements. */
public class RuneProofExportTest extends MockedTest {
    private static final String REVISION = "633ab56e2eb3eb363f21da3fd75f6f2bc0fa073a";
    private static final Gson JSON = new GsonBuilder().disableHtmlEscaping().serializeNulls().create();

    static Map<String, Object> obj(Object... pairs) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) result.put((String) pairs[i], pairs[i + 1]);
        return result;
    }

    @Test
    @SuppressWarnings("unchecked")
    void exportCatalog() throws Exception {
        Path mapPath = Path.of(Objects.requireNonNull(System.getenv("RUNEPROOF_CATALOG_MAP")));
        Path output = Path.of(Objects.requireNonNull(System.getenv("RUNEPROOF_EXPORT_OUT")));
        List<Map<String, Object>> catalog = JSON.fromJson(Files.readString(mapPath), List.class);
        List<Object> graphs = new ArrayList<>();
        List<Object> variants = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (AccountType profile : List.of(AccountType.IRONMAN, AccountType.NORMAL)) {
        seen.clear();
        when(playerStateManager.getAccountType()).thenReturn(profile);
        for (Map<String, Object> entry : catalog) {
            for (Map<String, Object> mapped : (List<Map<String, Object>>) entry.get("helpers")) {
                String enumId = (String) mapped.get("enum");
                if (!seen.add(enumId)) continue;
                String sourceText = Files.readString(Path.of((String) mapped.get("sourcePath")));
                boolean accountDependent = sourceText.contains("getAccountType(");
                if (profile == AccountType.NORMAL && !accountDependent) continue;
                Map<String, Object> graph = obj("accountProfile", profile.name(), "profileDependent", accountDependent, "helperEnum", enumId, "className", mapped.get("className"),
                    "sourcePath", mapped.get("sourcePath"));
                if (profile == AccountType.IRONMAN) graphs.add(graph); else variants.add(graph);
                try {
                    QuestHelperQuest quest = QuestHelperQuest.valueOf(enumId);
                    QuestHelper helper = quest.getQuestHelper().getClass().getDeclaredConstructor().newInstance();
                    helper.setQuest(quest);
                    injector.injectMembers(helper);
                    helper.setInjector(injector);
                    helper.setQuestHelperPlugin(questHelperPlugin);
                    helper.setConfig(questHelperConfig);
                    helper.init();
                    Exporter exporter = new Exporter();
                    if (sourceText.contains("client.get")) exporter.diagnostics.add("Client-state-dependent source: inspect constructor/setup/load paths before compiling a universal route.");
                    if (accountDependent) exporter.diagnostics.add("Account-profile-dependent source: primary IRONMAN and NORMAL variant exported separately; compare before conversion.");
                    exporter.reserveFields(helper);
                    graph.put("panels", exporter.value(helper.getPanels()));
                    List<Object> roots = new ArrayList<>();
                    if (helper instanceof BasicQuestHelper) {
                        ((BasicQuestHelper) helper).getStepList().entrySet().stream()
                            .sorted(Map.Entry.comparingByKey()).forEach(e -> roots.add(obj("state", e.getKey(), "node", exporter.value(e.getValue()))));
                    } else {
                        // Complex helpers expose their graph via declared step fields, not numeric quest-state ordering.
                        exporter.diagnostics.add("ComplexStateQuestHelper: use named step roots and source; no numeric stage ordering inferred.");
                    }
                    graph.put("roots", roots);
                    graph.put("fieldAliases", exporter.exportFields(helper));
                    graph.put("nodes", exporter.nodes);
                    graph.put("diagnostics", exporter.diagnostics);
                    graph.put("status", "exported-evidence");
                } catch (Throwable error) {
                    graph.put("status", "initialization-failed");
                    graph.put("diagnostics", List.of(error.getClass().getName() + ": " + String.valueOf(error.getMessage())));
                }
                System.out.println("RuneProof export: " + enumId + " " + graph.get("status"));
            }
        }
        }
        Map<String, Object> export = obj("formatVersion", 1, "helperRevision", REVISION, "runeLiteVersion", "1.12.38",
            "interpretation", "Source object graph only. Panel order is presentation, not dependency order. Requirements are not evaluated. Inventory effects and Fate-Locked permissions require reviewed conversion.",
            "initializationProfile", "Quest Helper MockedTest with primary IRONMAN account; mocked client and inventory. Source construction may branch on client state; source review required.",
            "catalog", catalog, "helperGraphs", graphs, "profileVariants", variants,
            "omittedFields", "Injected services, runtime rendering/cache fields, and null attributes are omitted. Conditional default null keys and all condition structure remain explicit.");
        Files.createDirectories(output.getParent());
        try (GZIPOutputStream compressed = new GZIPOutputStream(Files.newOutputStream(output))) {
            compressed.write((JSON.toJson(export) + "\n").getBytes(StandardCharsets.UTF_8));
        }
    }

    static class Exporter {
        final IdentityHashMap<Object, String> ids = new IdentityHashMap<>();
        final Set<Object> emitted = Collections.newSetFromMap(new IdentityHashMap<>());
        final List<Map<String, Object>> nodes = new ArrayList<>();
        final Set<String> diagnostics = new TreeSet<>();
        int sequence;
        static final Set<String> OMIT = Set.of("knownContainerStates", "currentRender", "mapPoint", "tileHighlights", "npcs", "objects", "icon", "customIcons", "widgetsToHighlight", "geInterfaceIcon", "lastDialogSeen", "started", "ARROW_SHIFT_Y", "MAX_RENDER_SIZE");

        List<Field> fields(Class<?> type) {
            List<Field> fields = new ArrayList<>();
            for (Class<?> c = type; c != null && c != Object.class; c = c.getSuperclass()) {
                if (!c.getName().startsWith("com.questhelper.")) break;
                for (Field f : c.getDeclaredFields()) if (!Modifier.isStatic(f.getModifiers()) && !f.isSynthetic()) fields.add(f);
            }
            fields.sort(Comparator.comparing(f -> f.getDeclaringClass().getName() + ":" + f.getName()));
            return fields;
        }

        void reserveFields(QuestHelper helper) throws IllegalAccessException {
            for (Field f : fields(helper.getClass())) {
                if (f.getDeclaringClass() == QuestHelper.class) continue;
                f.setAccessible(true);
                Object v = f.get(helper);
                if (v instanceof QuestStep || v instanceof Requirement || v instanceof PanelDetails) ids.putIfAbsent(v, "field:" + f.getName());
            }
        }

        Map<String, Object> exportFields(QuestHelper helper) throws IllegalAccessException {
            Map<String, Object> result = new LinkedHashMap<>();
            for (Field f : fields(helper.getClass())) {
                if (f.getDeclaringClass() == QuestHelper.class) continue;
                f.setAccessible(true);
                Object v = f.get(helper);
                if (v instanceof QuestStep || v instanceof Requirement || v instanceof PanelDetails) result.put(f.getName(), value(v));
            }
            return result;
        }

        Object value(Object v) {
            if (v == null || v instanceof String || v instanceof Number || v instanceof Boolean) return v;
            if (v instanceof Character) return v.toString();
            if (v instanceof Enum<?>) return obj("enumType", v.getClass().getName(), "name", ((Enum<?>) v).name());
            if (v instanceof WorldPoint) {
                WorldPoint p = (WorldPoint) v;
                return obj("type", "WorldPoint", "x", p.getX(), "y", p.getY(), "plane", p.getPlane());
            }
            if (v instanceof Pattern) return obj("type", "Pattern", "pattern", ((Pattern) v).pattern(), "flags", ((Pattern) v).flags());
            if (v.getClass().isArray()) {
                List<Object> result = new ArrayList<>();
                for (int i = 0; i < Array.getLength(v); i++) result.add(value(Array.get(v, i)));
                return result;
            }
            if (v instanceof Collection<?>) {
                List<Object> result = new ArrayList<>();
                for (Object child : (Collection<?>) v) result.add(value(child));
                return result;
            }
            if (v instanceof Map<?, ?>) {
                List<Object> entries = new ArrayList<>();
                ((Map<?, ?>) v).forEach((key, child) -> entries.add(obj("key", value(key), "value", value(child))));
                return obj("type", "Map", "ordered", v instanceof LinkedHashMap<?, ?> || v instanceof SortedMap<?, ?>, "entries", entries);
            }
            String type = v.getClass().getName();
            boolean supported = !(v instanceof QuestHelper) && (type.startsWith("com.questhelper.steps.")
                || type.startsWith("com.questhelper.requirements.") || type.startsWith("com.questhelper.panel.")
                || v instanceof QuestStep || v instanceof Requirement);
            if (!supported) {
                diagnostics.add("Opaque object type: " + type);
                return obj("opaqueType", type);
            }
            String id = ids.computeIfAbsent(v, ignored -> "node:" + (++sequence));
            if (!emitted.add(v)) return obj("$ref", id);
            if (nodes.size() >= 100000) throw new IllegalStateException("Graph node safety limit reached");
            Map<String, Object> attributes = new LinkedHashMap<>();
            Map<String, Object> node = obj("id", id, "type", type,
                "kind", v instanceof QuestStep ? "step" : v instanceof Requirement ? "requirement" : "support",
                "sourcePath", type.startsWith("com.questhelper.") ? "src/main/java/" + type.split("\\$")[0].replace('.', '/') + ".java" : null,
                "fields", attributes);
            nodes.add(node);
            if (v instanceof ConditionalStep) {
                // Ordered condition -> step pairs; the null key is the fallback, not an unconditional first action.
                node.put("conditionalEdges", value(((ConditionalStep) v).getStepsMap()));
            }
            if (v instanceof QuestStep && !type.startsWith("com.questhelper.steps.")) {
                diagnostics.add("Custom quest step needs source interpretation: " + type);
            }
            for (Field f : fields(v.getClass())) {
                if (OMIT.contains(f.getName())) continue;
                if (f.getName().equals("questHelper") || f.getName().equals("steps") && v instanceof ConditionalStep) continue;
                boolean injected = Arrays.stream(f.getAnnotations()).anyMatch(a -> a.annotationType().getSimpleName().equals("Inject"));
                if (injected) continue;
                try {
                    f.setAccessible(true);
                    Object child = f.get(v);
                    if (child != null) attributes.put(f.getDeclaringClass().getSimpleName() + "." + f.getName(), value(child));
                } catch (ReflectiveOperationException | RuntimeException error) {
                    diagnostics.add("Unreadable field: " + type + "." + f.getName() + " (" + error.getClass().getSimpleName() + ")");
                }
            }
            return obj("$ref", id);
        }
    }
}

