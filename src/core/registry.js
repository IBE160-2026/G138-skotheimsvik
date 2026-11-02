/**
 * Trainer registry.
 *
 * FR-11 / US-1.3: a trainer is registered by supplying a generator factory, a
 * renderer kind, a round-mode declaration and a headline-score declaration.
 * Registering one must not require editing engine code — so nothing in
 * src/core/ imports a trainer, only the other way round.
 */

const REQUIRED_FIELDS = ['id', 'name', 'roundMode', 'headlineScore', 'createGenerator', 'modeParam'];

export function createRegistry() {
  /** @type {Map<string, object>} */
  const trainers = new Map();

  /**
   * @param {object} trainer
   */
  function register(trainer) {
    for (const field of REQUIRED_FIELDS) {
      if (trainer?.[field] === undefined) {
        throw new Error(`Trainer is missing required field "${field}".`);
      }
    }
    if (!['timed', 'lives'].includes(trainer.roundMode)) {
      throw new Error(`Trainer "${trainer.id}" declares unknown round mode "${trainer.roundMode}".`);
    }
    if (trainers.has(trainer.id)) {
      throw new Error(`Trainer "${trainer.id}" is already registered.`);
    }
    trainers.set(trainer.id, trainer);
    return trainer;
  }

  return {
    register,
    get: (id) => trainers.get(id) ?? null,
    has: (id) => trainers.has(id),
    list: () => [...trainers.values()],
    get size() {
      return trainers.size;
    },
  };
}
