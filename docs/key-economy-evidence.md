# Key economy evidence protocol

## Consent and data flow

The tracker does not collect or transmit this report. A player explicitly
enters observed hours and clicks Export. The browser downloads aggregate JSON;
the player decides whether and where to share it. Nothing is uploaded automatically.

## Stage rules (schema version 1)

- Early: 0–24% overall tracker completion.
- Mid: 25–74%.
- Late: 75–100%.

The player declares the stage for the reporting window. The form shows the
stage suggested by current tracker completion.

## Included fields

- anonymous UUID report ID;
- game mode, declared stage, observed hours, schema/app version;
- per-source attempts, successes, expected successes, Fate Points;
- overall and per-source longest and active droughts.

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
