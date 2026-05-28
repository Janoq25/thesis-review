import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Programas académicos
  const [progIngenieria, progEducacion, progDerecho] = await Promise.all([
    prisma.program.upsert({
      where: { id: 'prog-ingenieria' },
      update: {},
      create: { id: 'prog-ingenieria', name: 'Maestría en Ingeniería de Sistemas' },
    }),
    prisma.program.upsert({
      where: { id: 'prog-educacion' },
      update: {},
      create: { id: 'prog-educacion', name: 'Maestría en Educación' },
    }),
    prisma.program.upsert({
      where: { id: 'prog-derecho' },
      update: {},
      create: { id: 'prog-derecho', name: 'Maestría en Derecho' },
    }),
  ]);

  // 2. Usuarios de cada rol
  const hashedPassword = await bcrypt.hash('ThesisReview2025!', 12);

  const [admin, coordinator, advisor1, advisor2, student1, student2, student3] =
    await Promise.all([
      prisma.user.upsert({
        where: { email: 'admin@universidad.edu.pe' },
        update: {},
        create: {
          email: 'admin@universidad.edu.pe',
          passwordHash: hashedPassword,
          name: 'Administrador Sistema',
          role: 'ADMIN',
        },
      }),
      prisma.user.upsert({
        where: { email: 'coordinadora@universidad.edu.pe' },
        update: {},
        create: {
          email: 'coordinadora@universidad.edu.pe',
          passwordHash: hashedPassword,
          name: 'María Castillo Vega',
          role: 'COORDINATOR',
          programId: progIngenieria.id,
        },
      }),
      prisma.user.upsert({
        where: { email: 'jperez@universidad.edu.pe' },
        update: {},
        create: {
          email: 'jperez@universidad.edu.pe',
          passwordHash: hashedPassword,
          name: 'Dr. Jorge Pérez Sánchez',
          role: 'ADVISOR',
          programId: progIngenieria.id,
        },
      }),
      prisma.user.upsert({
        where: { email: 'dsalinas@universidad.edu.pe' },
        update: {},
        create: {
          email: 'dsalinas@universidad.edu.pe',
          passwordHash: hashedPassword,
          name: 'Dra. Diana Salinas Roque',
          role: 'ADVISOR',
          programId: progEducacion.id,
        },
      }),
      prisma.user.upsert({
        where: { email: 'ktorres@estudiante.edu.pe' },
        update: {},
        create: {
          email: 'ktorres@estudiante.edu.pe',
          passwordHash: hashedPassword,
          name: 'Torres Mendoza, Karla',
          role: 'STUDENT',
          programId: progIngenieria.id,
        },
      }),
      prisma.user.upsert({
        where: { email: 'jrivera@estudiante.edu.pe' },
        update: {},
        create: {
          email: 'jrivera@estudiante.edu.pe',
          passwordHash: hashedPassword,
          name: 'Rivera Salas, Juan',
          role: 'STUDENT',
          programId: progEducacion.id,
        },
      }),
      prisma.user.upsert({
        where: { email: 'scampos@estudiante.edu.pe' },
        update: {},
        create: {
          email: 'scampos@estudiante.edu.pe',
          passwordHash: hashedPassword,
          name: 'Campos Vera, Sandra',
          role: 'STUDENT',
          programId: progIngenieria.id,
        },
      }),
    ]);

  // 3. Asignar asesores a estudiantes
  await Promise.all([
    prisma.user.update({
      where: { id: student1.id },
      data: { advisorId: advisor1.id },
    }),
    prisma.user.update({
      where: { id: student2.id },
      data: { advisorId: advisor2.id },
    }),
    prisma.user.update({
      where: { id: student3.id },
      data: { advisorId: advisor1.id },
    }),
  ]);

  // 4. Templates institucionales (sin archivo real en seed)
  const templateIngenieria = await prisma.thesisTemplate.upsert({
    where: { id: 'tpl-ingenieria-v2' },
    update: {},
    create: {
      id: 'tpl-ingenieria-v2',
      programId: progIngenieria.id,
      name: 'Patrón Maestría Ingeniería de Sistemas',
      version: '2.1',
      fileKey: 'templates/ingenieria-v2.1.docx',
      isActive: true,
      extractedSchema: {
        sections: [
          { name: 'Portada', required: true, minPages: 1 },
          { name: 'Resumen / Abstract', required: true, minPages: 1 },
          { name: 'Índice', required: true, minPages: 1 },
          {
            name: 'CAPITULO I: INTRODUCCIÓN',
            required: true,
            minPages: 8,
            subsections: [
              'Realidad Problemática',
              'Formulación del problema',
              'Objetivos',
              'Justificación',
            ],
          },
          {
            name: 'CAPITULO II: MÉTODO',
            required: true,
            minPages: 10,
            subsections: [
              'Tipo y diseño de investigación',
              'Variables y Operacionalización',
              'Población, muestra y muestreo',
              'Técnicas e instrumentos de recolección de datos',
              'Procedimientos',
              'Método de análisis de datos',
              'Aspectos éticos',
            ],
          },
          {
            name: 'CAPITULO III: ASPECTOS ADMINISTRATIVOS',
            required: true,
            minPages: 4,
            subsections: [
              'Recursos y Presupuesto',
              'Cronograma de ejecución',
            ],
          },
          { name: 'Referencias bibliográficas', required: true, minPages: 2, format: 'APA 7' },
          { name: 'Anexos', required: false },
        ],
        citationFormat: 'APA 7',
        minReferences: 20,
        languageRequirement: 'academic_spanish',
      },
      rubric: {
        dimensions: [
          { name: 'structure', weight: 0.3, maxScore: 100 },
          { name: 'content', weight: 0.4, maxScore: 100 },
          { name: 'form', weight: 0.2, maxScore: 100 },
          { name: 'originality', weight: 0.1, maxScore: 100 },
        ],
        maxGrade: 20,
        approvalThreshold: 13,
      },
    },
  });

  // 5. Advance de ejemplo con análisis IA simulado
  const advance = await prisma.advance.upsert({
    where: { id: 'adv-torres-cap2-v3' },
    update: {},
    create: {
      id: 'adv-torres-cap2-v3',
      studentId: student1.id,
      programId: progIngenieria.id,
      templateId: templateIngenieria.id,
      advanceType: 'chapter_2',
      title: 'Capítulo II: Marco Teórico v3',
      version: 3,
      fileKey: 'advances/prog-ingenieria/student1/chapter_2/v3.docx',
      fileType: 'docx',
      fileSizeBytes: 2_450_000,
      pageCount: 42,
      status: 'AI_COMPLETE',
    },
  });

  const analysis = await prisma.aIAnalysis.upsert({
    where: { advanceId: advance.id },
    update: {},
    create: {
      advanceId: advance.id,
      structureScore: 90,
      contentScore: 85,
      formScore: 88,
      originalityScore: 92,
      overallScore: 88,
      gradeConverted: 17.6,
      processingMs: 18420,
      modelUsed: 'gpt-4o',
      executiveSummary:
        'El documento presenta una estructura sólida y coherente con el patrón institucional. ' +
        'Las bases teóricas están bien fundamentadas con fuentes actualizadas. ' +
        'Se detecta una deficiencia en la sección 2.3 (marco conceptual): ausencia de definiciones operacionales requeridas. ' +
        'Las citas siguen el formato APA 7, aunque se encontraron 3 referencias sin DOI verificable. ' +
        'Se recomienda priorizar la corrección del marco conceptual antes de enviar la próxima versión.',
      findings: {
        create: [
          {
            sectionRef: 'Capítulo II — Sección 2.3 Marco conceptual',
            pageRef: 18,
            severity: 'MAJOR',
            description:
              'La sección 2.3 no incluye definiciones operacionales de los conceptos clave: ' +
              '"aprendizaje adaptativo", "LMS" y "personalización". ' +
              'El patrón institucional exige al menos 5 definiciones operacionales (p. 12).',
            correctionSteps:
              'Para cada término clave, redacte una definición de 3-5 líneas que incluya: ' +
              '(1) definición etimológica o conceptual, ' +
              '(2) uso específico en el contexto de su investigación, ' +
              '(3) cita de una fuente de autoridad reconocida en el área.',
            exampleImprovement:
              'El aprendizaje adaptativo, según Siemens (2005), es un proceso en el que los sistemas ' +
              'de información ajustan dinámicamente el contenido y la secuencia de actividades ' +
              'según el perfil cognitivo del estudiante, optimizando así la experiencia formativa.',
            recommendation:
              'Consulte el glosario del IEEE sobre tecnologías educativas y el Diccionario de Ciencias ' +
              'de la Educación (Santillana) para bases conceptuales sólidas.',
          },
          {
            sectionRef: 'Referencias bibliográficas',
            pageRef: 38,
            severity: 'MINOR',
            description:
              '3 referencias bibliográficas (Torres & García 2019, Liu et al. 2021, Kumar 2020) ' +
              'no incluyen DOI ni URL de acceso, incumpliendo el formato APA 7ª edición.',
            correctionSteps:
              'Para cada referencia sin DOI: (1) busque el artículo en Google Scholar, ' +
              '(2) localice el DOI en CrossRef (doi.org), ' +
              '(3) agregue el campo "https://doi.org/XXXXXXX" al final de la cita.',
            exampleImprovement:
              'Torres, A., & García, R. (2019). Adaptive learning systems in LMS. ' +
              'Journal of Educational Technology, 15(2), 45-62. https://doi.org/10.XXXX/XXXX',
            recommendation:
              'Use el gestor bibliográfico Zotero con el conector de Chrome para capturar ' +
              'automáticamente el DOI al guardar referencias desde bases de datos académicas.',
          },
          {
            sectionRef: 'Capítulo II — Sección 2.1 Antecedentes',
            pageRef: 8,
            severity: 'SUGGESTION',
            description:
              'La sección 2.1 cita exclusivamente fuentes internacionales. ' +
              'Se recomienda incorporar antecedentes regionales o latinoamericanos.',
            correctionSteps:
              'Busque en CONCYTEC (concytec.gob.pe), RENATI o SciELO Perú ' +
              'investigaciones sobre aprendizaje virtual en contexto latinoamericano (2020-2025). ' +
              'Incorpore al menos 2 antecedentes locales con análisis comparativo.',
            exampleImprovement:
              'En el contexto latinoamericano, Mendoza & Quispe (2022) demostraron que los sistemas ' +
              'LMS adaptativos incrementaron en un 23% la tasa de retención en universidades peruanas...',
            recommendation:
              'La inclusión de antecedentes locales fortalece la justificación del problema ' +
              'y sitúa la investigación en el contexto nacional, lo cual es valorado por los evaluadores.',
          },
        ],
      },
    },
  });

  console.log('✓ Seed completado');
  console.log('\nCredenciales de prueba (contraseña: ThesisReview2025!):');
  console.log('  Admin:       admin@universidad.edu.pe');
  console.log('  Coordinador: coordinadora@universidad.edu.pe');
  console.log('  Asesor:      jperez@universidad.edu.pe');
  console.log('  Estudiante:  ktorres@estudiante.edu.pe');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
