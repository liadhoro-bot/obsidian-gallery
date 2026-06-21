import assert from 'node:assert/strict'
import {
  calculateRankingScores,
  deltaE,
  hexToLab,
  normalizeBrand,
  normalizeLine,
  normalizePaintCode,
  normalizePaintName,
} from '../utils/paint-conversions'

const normalizationCases = [
  [normalizeBrand('Games Workshop'), 'citadel'],
  [normalizeBrand('GW'), 'citadel'],
  [normalizeBrand('The Army Painter'), 'army painter'],
  [normalizeBrand('Monument Hobbies'), 'pro acryl'],
  [normalizeLine('Vallejo Model Colour'), 'model color'],
  [normalizeLine('Citadel Contrast Paint'), 'contrast'],
  [normalizePaintName("  Abaddon's   Black Paint!!! "), 'abaddons black'],
  [normalizePaintCode('SKU: 72.001'), '72001'],
]

for (const [actual, expected] of normalizationCases) {
  assert.equal(actual, expected)
}

const blackLab = hexToLab('#000000')
const whiteLab = hexToLab('#ffffff')
assert.equal(Math.round(blackLab.l), 0)
assert.equal(Math.round(whiteLab.l), 100)
assert.ok(deltaE(blackLab, whiteLab) > 90)

const scores = calculateRankingScores([
  {
    connection_type: 'official_conversion',
    confidence_score: 0.92,
    distance_delta_e: null,
    source_id: 'source-a',
  },
  {
    connection_type: 'hex_similarity',
    confidence_score: 0.8,
    distance_delta_e: 4.25,
    source_id: null,
  },
])

assert.equal(scores.official_score, 0.92)
assert.equal(scores.hex_score, 0.8)
assert.equal(scores.manual_score, 0)
assert.equal(scores.source_count, 1)
assert.equal(scores.min_delta_e, 4.25)
assert.ok(scores.overall_score > 0.69 && scores.overall_score < 0.71)
assert.equal(scores.is_hidden, false)

console.log('Paint conversion validation passed')
