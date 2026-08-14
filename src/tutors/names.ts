const EXCEPTIONS: Record<string, string> = {
  лев: 'Львом',
  пётр: 'Петром',
  петр: 'Петром',
  павел: 'Павлом',
  любовь: 'Любовью',
  илья: 'Ильёй',
  дарья: 'Дарьей',
  софья: 'Софьей',
  наталья: 'Натальей',
  мария: 'Марией',
  юлия: 'Юлией',
  анастасия: 'Анастасией',
  евгений: 'Евгением',
  василий: 'Василием',
  арсений: 'Арсением',
}

function cap(src: string, out: string): string {
  if (!src) return out
  if (src[0] === src[0]!.toUpperCase()) return out[0]!.toUpperCase() + out.slice(1)
  return out
}

function oneWord(word: string): string {
  const raw = word.trim()
  if (!raw) return raw
  const lower = raw.toLowerCase()
  const ex = EXCEPTIONS[lower]
  if (ex) return cap(raw, ex.toLowerCase())

  if (/ова$|ева$|ёва$/.test(lower)) return cap(raw, lower.slice(0, -1) + 'ой')
  if (/ина$/.test(lower) && lower.length > 4) return cap(raw, lower.slice(0, -1) + 'ой')
  if (/ая$/.test(lower)) return cap(raw, lower.slice(0, -2) + 'ой')
  if (/ская$/.test(lower)) return cap(raw, lower.slice(0, -2) + 'ой')
  if (/ский$/.test(lower)) return cap(raw, lower.slice(0, -2) + 'им')
  if (/ов$|ев$|ёв$/.test(lower)) return cap(raw, lower + 'ым')
  if (/ин$/.test(lower) && lower.length > 3) return cap(raw, lower + 'ым')

  if (/ий$/.test(lower)) return cap(raw, lower.slice(0, -2) + 'ием')
  if (/ай$|ей$|ой$|уй$|ый$/.test(lower)) return cap(raw, lower.slice(0, -1) + 'ем')
  if (/й$/.test(lower)) return cap(raw, lower.slice(0, -1) + 'ем')

  if (/[шжчщ]а$/.test(lower)) return cap(raw, lower.slice(0, -1) + 'ей')
  if (/а$/.test(lower)) return cap(raw, lower.slice(0, -1) + 'ой')
  if (/ия$/.test(lower)) return cap(raw, lower.slice(0, -1) + 'ей')
  if (/я$/.test(lower)) return cap(raw, lower.slice(0, -1) + 'ей')

  if (/овь$/.test(lower)) return cap(raw, lower.slice(0, -1) + 'ью')
  if (/ь$/.test(lower)) return cap(raw, lower.slice(0, -1) + 'ем')

  return cap(raw, lower + 'ом')
}

/** «Анна» → «Анной» для фразы «абонемент с Анной». */
export function instrumentalName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(oneWord)
    .join(' ')
}
