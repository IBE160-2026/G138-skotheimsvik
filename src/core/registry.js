/**
 * Category and trainer registry.
 *
 * FR-6 / FR-7: a trainer declares its category, round mode, variant kind,
 * variants, score direction, topics, a generator and a renderer. Registering
 * one must not require editing engine code — so nothing in src/core/ imports a
 * trainer, only the other way round.
 *
 * Validation is deliberately strict and throws rather than warning. A malformed
 * trainer is a programming error that should surface on the first page load,
 * not a content error to be skipped quietly at runtime.
 */

import { BANDS, isValidVariant, parseBoardSize } from './variants.js';

const ROUND_MODES = ['timed', 'lives', 'completion'];
const VARIANT_KINDS = ['band', 'boardSize'];
const SCORE_DIRECTIONS = ['higher', 'lower'];

const REQUIRED_FIELDS = [
  'id',
  'categoryId',
  'name',
  'roundMode',
  'variantKind',
  'scoreDirection',
  'createGenerator',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function createRegistry() {
  /** @type {Map<string, object>} */
  const categories = new Map();
  /** @type {Map<string, object>} */
  const trainers = new Map();

  function registerCategory(category) {
    assert(typeof category?.id === 'string' && category.id, 'Category needs an id.');
    assert(!categories.has(category.id), `Category "${category.id}" is already registered.`);
    categories.set(category.id, { order: categories.size, ...category });
    return category;
  }

  function registerTrainer(trainer) {
    for (const field of REQUIRED_FIELDS) {
      assert(trainer?.[field] !== undefined, `Trainer is missing required field "${field}".`);
    }

    const { id, categoryId, roundMode, variantKind, scoreDirection } = trainer;
    assert(!trainers.has(id), `Trainer "${id}" is already registered.`);
    assert(categories.has(categoryId), `Trainer "${id}" names unknown category "${categoryId}".`);
    assert(ROUND_MODES.includes(roundMode), `Trainer "${id}" has unknown round mode "${roundMode}".`);
    assert(VARIANT_KINDS.includes(variantKind), `Trainer "${id}" has unknown variant kind "${variantKind}".`);
    assert(
      SCORE_DIRECTIONS.includes(scoreDirection),
      `Trainer "${id}" has unknown score direction "${scoreDirection}".`,
    );

    if (variantKind === 'boardSize') {
      assert(
        Array.isArray(trainer.variants) && trainer.variants.length > 0,
        `Trainer "${id}" uses board sizes but declares no variants.`,
      );
      for (const key of trainer.variants) {
        assert(parseBoardSize(key), `Trainer "${id}" has unparseable board size "${key}".`);
      }
    }

    // A timed band trainer gets its duration from the band, so modeParam is
    // optional there and required everywhere else.
    const derivesModeParam =
      typeof trainer.modeParamFor === 'function' ||
      (roundMode === 'timed' && variantKind === 'band');
    assert(
      derivesModeParam || typeof trainer.modeParam === 'number',
      `Trainer "${id}" must declare modeParam or modeParamFor.`,
    );

    trainers.set(id, { order: trainers.size, topics: [], ...trainer });
    return trainer;
  }

  /** Trainers belonging to a category, in registration order. */
  function trainersIn(categoryId) {
    return [...trainers.values()]
      .filter((trainer) => trainer.categoryId === categoryId)
      .sort((a, b) => a.order - b.order);
  }

  return {
    registerCategory,
    registerTrainer,
    getCategory: (id) => categories.get(id) ?? null,
    getTrainer: (id) => trainers.get(id) ?? null,
    hasTrainer: (id) => trainers.has(id),
    listCategories: () => [...categories.values()].sort((a, b) => a.order - b.order),
    listTrainers: () => [...trainers.values()].sort((a, b) => a.order - b.order),
    trainersIn,
    isValidVariant,
    get bands() {
      return [...BANDS];
    },
    get size() {
      return trainers.size;
    },
  };
}
