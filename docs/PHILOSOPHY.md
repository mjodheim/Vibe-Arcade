# Vibe Arcade Philosophy

Vibe Arcade explores a development style where the primary interface is conversation rather than source code.

## The loop

1. Describe the experience we want.
2. Let AI turn that intent into a playable implementation.
3. Play the result.
4. Respond in ordinary language: fun, boring, confusing, ugly, unfair, too easy, missing something, or unexpectedly great.
5. Let AI adapt the product.
6. Repeat until the game feels right.

## What counts as useful input?

Anything a player would naturally say after trying the game.

Examples:

- “The mage does not feel powerful enough.”
- “I want loot that makes me change my build.”
- “I should be able to remap the controls.”
- “The map feels too linear.”
- “I want one more run.”

A request does not need to mention classes, APIs, data structures, frameworks, or patterns. The implementation should follow the desired experience rather than the other way around.

## What this is not

Vibe Arcade is not intended to prove that engineering knowledge is useless, nor that every kind of software should be built this way.

It is an experiment in how far modern AI systems can reduce the distance between **having an idea** and **being able to use or play the result**.

Games are an especially good test bed because feedback is immediate and human: the result either feels enjoyable, understandable, responsive, and worth replaying — or it does not.

## Public history

The source code is public, but the evolution is part of the artifact too. Each game should keep a VIBELOG recording the natural-language feedback that materially changed it.
