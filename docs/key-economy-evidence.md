# Key economy evidence protocol

## Consent and data flow

The tracker does not collect or transmit this report. A player explicitly
enters observed hours and clicks Export. The browser downloads aggregate JSON;
the player decides whether and where to share it. Nothing is uploaded automatically.

## Stage rules (schema version 2)

- Early: 0–24% overall tracker completion.
- Mid: 25–74%.
- Late: 75–100%.

The player declares the stage for the reporting window. The form shows the
stage suggested by current tracker completion.

## Included fields

- anonymous UUID report ID;
- game mode, declared stage, observed hours, schema/app version;
- per-source attempts, successes, Pity Keys, expected successes, Fate Points;
- overall and per-source longest and active droughts.

## What the counts mean

- A success is a roll that won a Key or an Omni-Key. A Pity Key is not a success:
  it is a miss that Fate paid for, and it is counted on its own as `pityKeys`.
- Expected successes add up each roll's chance of winning: the odds the roll
  recorded (a Ritual of Clarity roll's two draws included), or its threshold
  for an older roll that recorded none.
- A drought is a run of rolls in a row that did not win. A Pity Key does not end one.

Schema version 2 added `pityKeys` and stopped counting Pity Keys as successes.
A version 1 report counted every Pity Key in `successes`, ended a drought at one,
and took expected successes from thresholds only.

## Explicit exclusions

Account names, linked-account values, run IDs, raw history, event IDs,
exact timestamps, relay codes/tokens, chat, and device/network identifiers.

## Review gate

- at least 10 independent runs;
- at least 500 scoreable attempts in each of early, mid, and late;
- at least three materially different source categories in each stage;
- publish median keys/hour, interquartile range, and drought percentiles;
- freeze the accepted sample and model every candidate variant offline against
  that same sample;
- require a separate design and explicit approval before changing production
  rates.

## Deferred proposals

Brutus, diminishing odds, and per-boss lifetime caps are hypotheses to model,
not production changes in this implementation.
