import assert from 'node:assert/strict';
import test from 'node:test';
import {cardDescription} from '../src/lib/cardDescription';
import type {WebCharacter} from '../src/lib/types';

const character = (description: string): WebCharacter => ({
  character_i: 1,
  name: 'Николь',
  description,
  image_url: null,
  modes: ['fast', 'roleplay'],
  chat_code: null,
});

const cases: Array<{locale: string; character_i: number; age: number; description: string; expected: string}> = [
  {
    locale: 'ru', character_i: 1, age: 26,
    description: 'Вивиан, 26. Путешествует за новыми впечатлениями.\nТёплая, телесная и не делает вид, что ничего не происходит, если ты ей понравился',
    expected: 'Путешествует за новыми впечатлениями.\nТёплая, телесная и не делает вид, что ничего не происходит, если ты ей понравился',
  },
  {
    locale: 'en', character_i: 1, age: 26,
    description: "Vivian, 26. Traveling in search of new experiences.\nWarm, sensual, and doesn't pretend nothing's happening when she's into you.",
    expected: "Traveling in search of new experiences.\nWarm, sensual, and doesn't pretend nothing's happening when she's into you.",
  },
  {
    locale: 'ar', character_i: 1, age: 26,
    description: 'فيفيان، 26. تسافر تدور على تجارب جديدة.\n\nدافئة وتحب القرب واللمس، وإذا عجبها أحد ما تتظاهر إن ما فيه شيء.',
    expected: 'تسافر تدور على تجارب جديدة.\n\nدافئة وتحب القرب واللمس، وإذا عجبها أحد ما تتظاهر إن ما فيه شيء.',
  },
  {
    locale: 'ru', character_i: 2, age: 23,
    description: 'Юфи, 23. Стримит на Twitch и ходит на вечеринки.\nИгривая, слегка ебанутая и любит проверять людей на реакцию\n#aura_farming #girl_failure',
    expected: 'Стримит на Twitch и ходит на вечеринки.\nИгривая, слегка ебанутая и любит проверять людей на реакцию\n#aura_farming #girl_failure',
  },
  {
    locale: 'en', character_i: 2, age: 23,
    description: "Yuffie, 23. Streams on Twitch and goes to parties.\nPlayful, a little unhinged, and loves testing people's reactions.\n#aura_farming #girl_failure",
    expected: "Streams on Twitch and goes to parties.\nPlayful, a little unhinged, and loves testing people's reactions.\n#aura_farming #girl_failure",
  },
  {
    locale: 'ar', character_i: 2, age: 23,
    description: 'يوفي، 23. تسوي بثوث على Twitch وتروح حفلات.\n\nلعوبة، ومخبولة شوي، وتحب تختبر ردّات فعل الناس.\n\n#aura_farming #girl_failure',
    expected: 'تسوي بثوث على Twitch وتروح حفلات.\n\nلعوبة، ومخبولة شوي، وتحب تختبر ردّات فعل الناس.\n\n#aura_farming #girl_failure',
  },
  {
    locale: 'ru', character_i: 3, age: 25,
    description: 'Ева, 25. Бьёт партаки вручную и тусуется до утра.\nПошлая, смешливая, без особого фильтра между мыслями и языком. Иногда сама в ахуе от своих решений.',
    expected: 'Бьёт партаки вручную и тусуется до утра.\nПошлая, смешливая, без особого фильтра между мыслями и языком. Иногда сама в ахуе от своих решений.',
  },
  {
    locale: 'en', character_i: 3, age: 25,
    description: "Eva, 25. Hand-pokes janky little tattoos and parties till sunrise.\nDirty-minded, quick to laugh, with almost no filter between her brain and her mouth. Sometimes even she can't believe the choices she makes.",
    expected: "Hand-pokes janky little tattoos and parties till sunrise.\nDirty-minded, quick to laugh, with almost no filter between her brain and her mouth. Sometimes even she can't believe the choices she makes.",
  },
  {
    locale: 'ar', character_i: 3, age: 25,
    description: 'إيفا، 25. تسوي وشوم handpoke ملخبطة، وتسهر لين الصبح.\n\nتفكيرها وصخ، وضحكتها قريبة، وما عندها فلتر بين مخّها ولسانها. وأحيانًا حتى هي مو مصدّقة قراراتها.',
    expected: 'تسوي وشوم handpoke ملخبطة، وتسهر لين الصبح.\n\nتفكيرها وصخ، وضحكتها قريبة، وما عندها فلتر بين مخّها ولسانها. وأحيانًا حتى هي مو مصدّقة قراراتها.',
  },
  {
    locale: 'ru', character_i: 4, age: 39,
    description: 'Николь, 39. Обеспеченная женщина, владелица агентства элитной недвижимости. Живёт одна в просторном современном пентхаусе.',
    expected: 'Обеспеченная женщина, владелица агентства элитной недвижимости. Живёт одна в просторном современном пентхаусе.',
  },
  {
    locale: 'en', character_i: 4, age: 39,
    description: 'Nicole, 39. A wealthy woman who owns a luxury real estate agency. Lives alone in a sick penthouse.',
    expected: 'A wealthy woman who owns a luxury real estate agency. Lives alone in a sick penthouse.',
  },
  {
    locale: 'ar', character_i: 4, age: 39,
    description: 'نيكول، 39. امرأة ثرية تملك وكالة عقارات فاخرة. تعيش لحالها في بنتهاوس رهيب.',
    expected: 'امرأة ثرية تملك وكالة عقارات فاخرة. تعيش لحالها في بنتهاوس رهيب.',
  },
];

for (const item of cases) {
  test(`${item.locale} character ${item.character_i}: drops the localized name/age lead and keeps the rest verbatim`, () => {
    assert.equal(cardDescription(character(item.description), item.age), item.expected);
  });
}

test('keeps line breaks untouched', () => {
  const description = 'Николь, 39. Первая строка.\n\nВторая строка.\nТретья.';
  assert.equal(cardDescription(character(description), 39), 'Первая строка.\n\nВторая строка.\nТретья.');
});

test('returns the original text when the age does not match', () => {
  const description = 'Николь, 39. Обеспеченная женщина.';
  assert.equal(cardDescription(character(description), 26), description);
});

test('does not strip the unsupported adjectival age form', () => {
  const description = 'Николь, 39-летняя обеспеченная женщина.';
  assert.equal(cardDescription(character(description), 39), description);
});

test('returns the original text without a leading name/age prefix', () => {
  const description = 'Обеспеченная женщина, владелица агентства.';
  assert.equal(cardDescription(character(description), 39), description);
});

test('returns the original text when no age is known', () => {
  const description = 'Николь, 39. Обеспеченная женщина.';
  assert.equal(cardDescription(character(description)), description);
});

test('returns the original text when the lead would leave nothing behind', () => {
  const description = 'Николь, 39.';
  assert.equal(cardDescription(character(description), 39), description);
});
