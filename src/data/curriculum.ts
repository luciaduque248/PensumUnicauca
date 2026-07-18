import type { CurriculumSection } from '../types/curriculum'
import { prerequisitesBySubject } from './prerequisites'

const curriculumBase: CurriculumSection[] = [
  {
    id: 'additional-requirements',
    title: 'Requisitos adicionales',
    subjects: [
      {
        code: 'ANTEPR',
        name: 'Anteproyecto',
        credits: 2,
        prerequisites: [],
      },
      {
        code: '21590',
        name: 'Electiva FISH I',
        credits: 2,
        prerequisites: [],
      },
      {
        code: 'EFISH2',
        name: 'Electiva FISH II',
        credits: 2,
        prerequisites: [],
      },
    ],
  },
  {
    id: 'semester-1',
    title: 'Semestre 1',
    semester: 1,
    subjects: [
      {
        code: 'MAT102.1',
        name: 'Álgebra Lineal',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'MAT101.1',
        name: 'Cálculo Diferencial',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'IAT101',
        name: 'Introducción a la Ingeniería',
        credits: 2,
        prerequisites: [],
      },
      {
        code: 'BAI101',
        name: 'Introducción a los Circuitos Eléctricos',
        credits: 1,
        prerequisites: [],
      },
      {
        code: '21505',
        name: 'Lectura y Escritura',
        credits: 2,
        prerequisites: [],
      },
    ],
  },
  {
    id: 'semester-2',
    title: 'Semestre 2',
    semester: 2,
    subjects: [
      {
        code: 'M33530',
        name: 'Cálculo Integral',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33532',
        name: 'Circuitos de Corriente Directa',
        credits: 2,
        prerequisites: [],
      },
      {
        code: 'M34240',
        name: 'Ética',
        credits: 2,
        prerequisites: [],
      },
      {
        code: 'M33531',
        name: 'Mecánica',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33533',
        name: 'Programación Orientada a Objetos',
        credits: 3,
        prerequisites: [],
      },
    ],
  },
  {
    id: 'semester-3',
    title: 'Semestre 3',
    semester: 3,
    subjects: [
      {
        code: 'M33539',
        name: 'Cálculo Vectorial',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33541',
        name: 'Circuitos de Corriente Alterna',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33544',
        name: 'Circuitos Digitales',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33542',
        name: 'Circuitos Electrónicos',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M34951',
        name: 'Ecuaciones Diferenciales Ordinarias - N',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33540',
        name: 'Electromagnetismo',
        credits: 3,
        prerequisites: [],
      },
    ],
  },
  {
    id: 'semester-4',
    title: 'Semestre 4',
    semester: 4,
    subjects: [
      {
        code: 'M33535',
        name: 'Algoritmos Computacionales',
        credits: 3,
        prerequisites: [],
      },
      {
        code: '11079',
        name: 'Campos',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33536',
        name: 'Circuitos Analógicos',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33537',
        name: 'Diseño de Circuitos con VHDL',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33534',
        name: 'Señales y Sistemas',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33538',
        name: 'Vibraciones y Ondas',
        credits: 3,
        prerequisites: [],
      },
    ],
  },
  {
    id: 'semester-5',
    title: 'Semestre 5',
    semester: 5,
    subjects: [
      {
        code: 'M33580',
        name: 'Fundamentos de Redes de Telecomunicaciones',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33579',
        name: 'Medios de Transmisión',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33578',
        name: 'Microcontroladores',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33581',
        name: 'Modelado y Bases de Datos',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33577',
        name: 'Probabilidad y Estadística',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33576',
        name: 'Procesamiento Digital de Señales PDS',
        credits: 3,
        prerequisites: [],
      },
    ],
  },
  {
    id: 'semester-6',
    title: 'Semestre 6',
    semester: 6,
    subjects: [
      {
        code: 'M33582',
        name: 'Circuitos de RF',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33583',
        name: 'Comunicaciones Analógicas',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33585',
        name: 'Comunicaciones Digitales',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33586',
        name: 'Informática para Telecomunicaciones',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33584',
        name: 'Metodología de la Investigación',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'SCONMU',
        name: 'Sistemas de Conmutación',
        credits: 3,
        prerequisites: [],
      },
    ],
  },
  {
    id: 'semester-7',
    title: 'Semestre 7',
    semester: 7,
    subjects: [
      {
        code: 'M34636',
        name: 'Comunicaciones Móviles e Inalámbricas',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M34639',
        name: 'Emprendimiento e Innovación en Ingeniería',
        credits: 2,
        prerequisites: [],
      },
      {
        code: 'RADIOC',
        name: 'Radiocomunicaciones',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M34638',
        name: 'Servicios Convergentes',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M34637',
        name: 'Sistemas de Comunicaciones Ópticas',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M33587',
        name: 'Sistemas Embebidos y Tiempo Real',
        credits: 3,
        prerequisites: [],
      },
    ],
  },
  {
    id: 'semester-8',
    title: 'Semestre 8',
    semester: 8,
    subjects: [
      {
        code: 'M34641',
        name: 'Competencias Ciudadanas',
        credits: 2,
        prerequisites: [],
      },
      {
        code: 'ELE1',
        name: 'Electiva 1',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'ELE2',
        name: 'Electiva 2',
        credits: 3,
        prerequisites: [],
      },
      {
        code: '21454',
        name: 'Énfasis 1',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'LABSIST1',
        name: 'Laboratorio I de Sistemas de Telecomunicaciones',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M34640',
        name: 'Proyecto Integrador',
        credits: 3,
        prerequisites: [],
      },
    ],
  },
  {
    id: 'semester-9',
    title: 'Semestre 9',
    semester: 9,
    subjects: [
      {
        code: 'ELE3',
        name: 'Electiva 3',
        credits: 3,
        prerequisites: [],
      },
      {
        code: '21455',
        name: 'Énfasis 2',
        credits: 3,
        prerequisites: [],
      },
      {
        code: '21456',
        name: 'Énfasis 3',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M34642',
        name: 'Formulación y Gestión de Proyectos en TIC',
        credits: 2,
        prerequisites: [],
      },
      {
        code: 'M34644',
        name: 'Laboratorio II de Sistemas de Telecomunicaciones IAT901',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M34645',
        name: 'Laboratorio de Servicios Telemáticos',
        credits: 3,
        prerequisites: [],
      },
    ],
  },
  {
    id: 'semester-10',
    title: 'Semestre 10',
    semester: 10,
    subjects: [
      {
        code: 'M34646',
        name: 'Análisis Económico de Inversiones en TIC',
        credits: 2,
        prerequisites: [],
      },
      {
        code: '21457',
        name: 'Énfasis 4',
        credits: 3,
        prerequisites: [],
      },
      {
        code: 'M34952',
        name: 'Trabajo de Grado - N',
        credits: 11,
        prerequisites: [],
      },
    ],
  },
]

export const curriculum: CurriculumSection[] = curriculumBase.map(
  (section) => ({
    ...section,
    subjects: section.subjects.map((subject) => ({
      ...subject,
      prerequisites:
        prerequisitesBySubject[subject.code] ?? [],
    })),
  }),
)