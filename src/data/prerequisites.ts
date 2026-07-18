export const prerequisitesBySubject: Record<string, string[]> = {
  // Requisito adicional
  ANTEPR: [
    'M33582',
    'M33584',
    'M33586',
    'M33585',
    'M33583',
    'SCONMU',
  ],

  // Semestre 2
  M33530: ['MAT101.1'],
  M33532: ['MAT102.1'],
  M33531: ['MAT101.1'],

  // Semestre 3
  M33539: ['M33530'],
  M33541: ['M33532'],
  M33544: ['M33533'],
  M33542: ['M33532'],
  M34951: ['M33530'],
  M33540: ['M33531'],

  // Semestre 4
  M33535: ['M33533'],
  '11079': ['M33540'],
  M33536: ['M33542'],
  M33537: ['M33544'],
  M33534: ['M34951'],
  M33538: ['M33540'],

  // Semestre 5
  M33579: ['11079'],
  M33578: ['M33544'],
  M33581: ['M33535'],
  M33577: ['M33539'],
  M33576: ['M33534'],

  // Semestre 6
  M33582: ['M33536'],
  M33583: ['M33577', 'M33576'],
  M33585: ['M33577', 'M33534'],
  M33586: ['M33535'],
  SCONMU: ['M33580'],

  // Semestre 7
  M34636: ['M33583', 'M33585'],
  RADIOC: ['M33583', 'M33585'],
  M34638: ['SCONMU'],
  M34637: ['M33579', 'M33585'],
  M33587: ['M33578'],

  // Semestre 8
  M34641: ['M34240'],
  ELE2: ['ENFA1CX'],
  LABSIST1: ['RADIOC', 'M34637'],
  M34640: ['M33587'],

  // Semestre 9
  M34644: ['LABSIST1'],
  M34645: ['M34638'],

  // Semestre 10
  M34952: ['ANTEPR'],
}

export const externalPrerequisiteNames: Record<string, string> = {
  ENFA1CX: 'Énfasis I-Tm - Introducción a los Sistemas Telemáticos',
}