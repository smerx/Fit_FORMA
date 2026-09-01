import type { ActivityTemplate } from '../types'

export const ACTIVITIES: ActivityTemplate[] = [
  {
    id: 'elliptical-easy',
    name: 'Эллипсоид · лёгкий',
    met: 5,
    emoji: '🏃',
    hint: 'Спокойный темп',
  },
  {
    id: 'elliptical-mid',
    name: 'Эллипсоид · средний',
    met: 7,
    emoji: '🏃',
    hint: 'Уверенный темп',
  },
  {
    id: 'elliptical-hard',
    name: 'Эллипсоид · интенсивный',
    met: 9,
    emoji: '🏃',
    hint: 'Высокая нагрузка',
  },
  {
    id: 'walk',
    name: 'Ходьба',
    met: 3.5,
    emoji: '🚶',
    hint: 'Спокойный шаг',
  },
  {
    id: 'bike',
    name: 'Велосипед',
    met: 6.8,
    emoji: '🚴',
    hint: 'Умеренный темп',
  },
  {
    id: 'swim',
    name: 'Плавание',
    met: 6,
    emoji: '🏊',
    hint: 'Спокойное непрерывное плавание',
  },
  {
    id: 'custom',
    name: 'Своя активность',
    met: 4,
    emoji: '⚡',
    hint: 'Задай название и MET вручную',
    custom: true,
  },
]
