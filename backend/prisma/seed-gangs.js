require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const GANGS = [
  {
    gang_code: 'GANG 1',
    members: [
      { role: 'head_man', full_name: 'OSEI KOFI',        employee_id: 'G01-HM' },
      { role: 'docker',   full_name: 'FRANCIS SHAMO',    employee_id: 'G01-D1' },
      { role: 'docker',   full_name: 'NATHANIEL MENSAH', employee_id: 'G01-D2' },
      { role: 'docker',   full_name: 'JAMES ADDAE',      employee_id: 'G01-D3' },
      { role: 'docker',   full_name: 'BEN BANINI',       employee_id: 'G01-D4' },
    ],
  },
  {
    gang_code: 'GANG 2',
    members: [
      { role: 'head_man', full_name: 'VINCENT MENSAH',      employee_id: 'G02-HM' },
      { role: 'docker',   full_name: 'ANTHONY ENOO DANSO',  employee_id: 'G02-D1' },
      { role: 'docker',   full_name: 'ISAAC BADU',          employee_id: 'G02-D2' },
      { role: 'docker',   full_name: 'RICHMOND ODEI',       employee_id: 'G02-D3' },
      { role: 'docker',   full_name: 'ALBERT AMEDOR',       employee_id: 'G02-D4' },
    ],
  },
  {
    gang_code: 'GANG 3',
    members: [
      { role: 'head_man', full_name: 'ERIC FUMADOR',      employee_id: 'G03-HM' },
      { role: 'docker',   full_name: 'JOSEPH ANNIE',      employee_id: 'G03-D1' },
      { role: 'docker',   full_name: 'SETH ABBAM',        employee_id: 'G03-D2' },
      { role: 'docker',   full_name: 'ISAAC KOFI MENSAH', employee_id: 'G03-D3' },
      { role: 'docker',   full_name: 'JOSEPH NYARKO',     employee_id: 'G03-D4' },
    ],
  },
  {
    gang_code: 'GANG 4',
    members: [
      { role: 'head_man', full_name: 'HENRY DJABA',            employee_id: 'G04-HM' },
      { role: 'docker',   full_name: 'DAVID AMEVI OGBORDJOR',  employee_id: 'G04-D1' },
      { role: 'docker',   full_name: 'YAHAYA MOHAMMED',        employee_id: 'G04-D2' },
      { role: 'docker',   full_name: 'MICHAEL ARTHUR',         employee_id: 'G04-D3' },
      { role: 'docker',   full_name: 'FOSTER AZANDA',          employee_id: 'G04-D4' },
    ],
  },
  {
    gang_code: 'GANG 5',
    members: [
      { role: 'head_man', full_name: 'SAMPSON QUARSHIE',      employee_id: 'G05-HM' },
      { role: 'docker',   full_name: 'EMMANUEL BLIKO',        employee_id: 'G05-D1' },
      { role: 'docker',   full_name: 'FELIX DAKUDJI',         employee_id: 'G05-D2' },
      { role: 'docker',   full_name: 'SAMUEL ADAMS ESHUN',    employee_id: 'G05-D3' },
      { role: 'docker',   full_name: 'KELVIN S. K. AGBODJI',  employee_id: 'G05-D4' },
    ],
  },
  {
    gang_code: 'GANG 6',
    members: [
      { role: 'head_man', full_name: 'EMMANUEL OPARE', employee_id: 'G06-HM' },
      { role: 'docker',   full_name: 'JOSEPH ARTHUR',  employee_id: 'G06-D1' },
      { role: 'docker',   full_name: 'MICHAEL ADDAE',  employee_id: 'G06-D2' },
      { role: 'docker',   full_name: 'JAMES ARTHUR',   employee_id: 'G06-D3' },
      { role: 'docker',   full_name: 'ERIC BAAH',      employee_id: 'G06-D4' },
    ],
  },
  {
    gang_code: 'GANG 7',
    members: [
      { role: 'head_man', full_name: 'SOLOMON CUDJOE', employee_id: 'G07-HM' },
      { role: 'docker',   full_name: 'GEORGE SOLLEY',  employee_id: 'G07-D1' },
      { role: 'docker',   full_name: 'KWESI ABBAN',    employee_id: 'G07-D2' },
      { role: 'docker',   full_name: 'JOSEPH ODAI',    employee_id: 'G07-D3' },
      { role: 'docker',   full_name: 'AARON ASHITEY',  employee_id: 'G07-D4' },
    ],
  },
  {
    gang_code: 'GANG 8',
    members: [
      { role: 'head_man', full_name: 'THOMAS SANKAH',    employee_id: 'G08-HM' },
      { role: 'docker',   full_name: 'HUADJIE AKWETEY',  employee_id: 'G08-D1' },
      { role: 'docker',   full_name: 'JOE STEVE BAFFOE', employee_id: 'G08-D2' },
      { role: 'docker',   full_name: 'SIMON TETTEH',     employee_id: 'G08-D3' },
      { role: 'docker',   full_name: 'SAMUEL BORTEY',    employee_id: 'G08-D4' },
    ],
  },
  {
    gang_code: 'GANG 9',
    members: [
      { role: 'head_man', full_name: 'EBENEZER ADJEI',   employee_id: 'G09-HM' },
      { role: 'docker',   full_name: 'DENNIS KUGBADJOR', employee_id: 'G09-D1' },
      { role: 'docker',   full_name: 'GIDEON NYARKO',    employee_id: 'G09-D2' },
      { role: 'docker',   full_name: 'STEPHEN YAWSON',   employee_id: 'G09-D3' },
      { role: 'docker',   full_name: 'JULIUS NUETEY',    employee_id: 'G09-D4' },
    ],
  },
  {
    gang_code: 'GANG 10',
    members: [
      { role: 'head_man', full_name: 'KENNEDY TETTEYFIO',  employee_id: 'G10-HM' },
      { role: 'docker',   full_name: 'KWEKU AMFOH',        employee_id: 'G10-D1' },
      { role: 'docker',   full_name: 'DANIEL AKPENG',      employee_id: 'G10-D2' },
      { role: 'docker',   full_name: 'KASSIM FIRDAUS',     employee_id: 'G10-D3' },
      { role: 'docker',   full_name: 'NICK ERIC ACQUAYE',  employee_id: 'G10-D4' },
    ],
  },
  {
    gang_code: 'GANG 11',
    members: [
      { role: 'head_man', full_name: 'SIMON AKLORBORTU',   employee_id: 'G11-HM' },
      { role: 'docker',   full_name: 'ERIC ANDOH',         employee_id: 'G11-D1' },
      { role: 'docker',   full_name: 'EMMANUEL OKYERE',    employee_id: 'G11-D2' },
      { role: 'docker',   full_name: 'MICHAEL AMANKWAH',   employee_id: 'G11-D3' },
      { role: 'docker',   full_name: 'GERALD TETTEH',      employee_id: 'G11-D4' },
    ],
  },
  {
    gang_code: 'GANG 12',
    members: [
      { role: 'head_man', full_name: 'GODFRED AMASSAH',       employee_id: 'G12-HM' },
      { role: 'docker',   full_name: 'ISAAC ACHEAMPONG',      employee_id: 'G12-D1' },
      { role: 'docker',   full_name: 'EBENEZER ADJEI MENSAH', employee_id: 'G12-D2' },
      { role: 'docker',   full_name: 'ORESTICS ODURO',        employee_id: 'G12-D3' },
      { role: 'docker',   full_name: 'MESHACK ENU',           employee_id: 'G12-D4' },
    ],
  },
  {
    gang_code: 'GANG 13',
    members: [
      { role: 'head_man', full_name: 'JONATHAN SOSU',       employee_id: 'G13-HM' },
      { role: 'docker',   full_name: 'AMADU ABDUL RAHMAN',  employee_id: 'G13-D1' },
      { role: 'docker',   full_name: 'JOSHUA TETTEH',       employee_id: 'G13-D2' },
      { role: 'docker',   full_name: 'SETH AKUTEY',         employee_id: 'G13-D3' },
      { role: 'docker',   full_name: 'SYLVANUS AGBEVE',     employee_id: 'G13-D4' },
    ],
  },
  {
    gang_code: 'GANG 14',
    members: [
      { role: 'head_man', full_name: 'BONIFACE YOURKUU',  employee_id: 'G14-HM' },
      { role: 'docker',   full_name: 'MAXWELL ARHINFUL',  employee_id: 'G14-D1' },
      { role: 'docker',   full_name: 'ERNEST SMITH',      employee_id: 'G14-D2' },
      { role: 'docker',   full_name: 'MARCUS OFORI',      employee_id: 'G14-D3' },
      { role: 'docker',   full_name: 'GODSON FIANU',      employee_id: 'G14-D4' },
    ],
  },
  {
    gang_code: 'GANG 15',
    members: [
      { role: 'head_man', full_name: 'EBENEZER NEEQUAYE', employee_id: 'G15-HM' },
      { role: 'docker',   full_name: 'SAMUEL ADDO',       employee_id: 'G15-D1' },
      { role: 'docker',   full_name: 'SOLOMON OPATA',     employee_id: 'G15-D2' },
      { role: 'docker',   full_name: 'ROBERT OWUSU',      employee_id: 'G15-D3' },
      { role: 'docker',   full_name: 'SELORM AGBO',       employee_id: 'G15-D4' },
    ],
  },
  {
    gang_code: 'GANG 16',
    members: [
      { role: 'head_man', full_name: 'ISSAKA MOHAMMED',       employee_id: 'G16-HM' },
      { role: 'docker',   full_name: 'HENRY OKO BORTEY',      employee_id: 'G16-D1' },
      { role: 'docker',   full_name: 'FRANCIS KWAKU YEBOAH',  employee_id: 'G16-D2' },
      { role: 'docker',   full_name: 'GEORGE K. FRIMPONG',    employee_id: 'G16-D3' },
      { role: 'docker',   full_name: 'JOHN KONADU',           employee_id: 'G16-D4' },
    ],
  },
  {
    gang_code: 'GANG 17',
    members: [
      { role: 'head_man', full_name: 'NANA TUFFOUR',     employee_id: 'G17-HM' },
      { role: 'docker',   full_name: 'EMMANUEL DADZIE',  employee_id: 'G17-D1' },
      { role: 'docker',   full_name: 'HARRY MENSAH',     employee_id: 'G17-D2' },
      { role: 'docker',   full_name: 'STEPHEN OCANSEY',  employee_id: 'G17-D3' },
      { role: 'docker',   full_name: 'JOHN GHARTEY',     employee_id: 'G17-D4' },
    ],
  },
  {
    gang_code: 'GANG 18',
    members: [
      { role: 'head_man', full_name: 'GABRIEL AKUTEY',     employee_id: 'G18-HM' },
      { role: 'docker',   full_name: 'DAVID BROWN',         employee_id: 'G18-D1' },
      { role: 'docker',   full_name: 'CLEMENT KORANTENG',   employee_id: 'G18-D2' },
      { role: 'docker',   full_name: 'EMMANUEL ANNANG',     employee_id: 'G18-D3' },
      { role: 'docker',   full_name: 'MATTHIAS BONNAH',     employee_id: 'G18-D4' },
    ],
  },
  {
    gang_code: 'GANG 19',
    members: [
      { role: 'head_man', full_name: 'IBRAHIM BABA',    employee_id: 'G19-HM' },
      { role: 'docker',   full_name: 'EMMANUEL ANTOH',  employee_id: 'G19-D1' },
      { role: 'docker',   full_name: 'ISSAC AFFUL',     employee_id: 'G19-D2' },
      { role: 'docker',   full_name: 'DANIEL AGBO',     employee_id: 'G19-D3' },
      { role: 'docker',   full_name: 'ASARE ABBEY',     employee_id: 'G19-D4' },
    ],
  },
  {
    gang_code: 'GANG 20',
    members: [
      { role: 'head_man', full_name: 'CEPHAS SOBO',               employee_id: 'G20-HM' },
      { role: 'docker',   full_name: 'JOSEPH DADZIE',             employee_id: 'G20-D1' },
      { role: 'docker',   full_name: 'MICHAEL DENFUL',            employee_id: 'G20-D2' },
      { role: 'docker',   full_name: 'ISAIAH BORKETEY',           employee_id: 'G20-D3' },
      { role: 'docker',   full_name: 'SIMON BORKETEY ADJANAI',    employee_id: 'G20-D4' },
    ],
  },
  {
    gang_code: 'GANG 21',
    members: [
      { role: 'head_man', full_name: 'PAUL MENSAH',      employee_id: 'G21-HM' },
      { role: 'docker',   full_name: 'JOSEPH K. AMPAH',  employee_id: 'G21-D1' },
      { role: 'docker',   full_name: 'JOHN AIDOO',       employee_id: 'G21-D2' },
      { role: 'docker',   full_name: 'SETH OWUSU',       employee_id: 'G21-D3' },
      { role: 'docker',   full_name: 'FELIX ABROKWAH',   employee_id: 'G21-D4' },
    ],
  },
  {
    gang_code: 'GANG 22',
    members: [
      { role: 'head_man', full_name: 'EMMANUEL ADJEI',   employee_id: 'G22-HM' },
      { role: 'docker',   full_name: 'EDWARD MENSAH',    employee_id: 'G22-D1' },
      { role: 'docker',   full_name: 'STEPHEN NTSIFUL',  employee_id: 'G22-D2' },
      { role: 'docker',   full_name: 'SAMUEL ANIM',      employee_id: 'G22-D3' },
      { role: 'docker',   full_name: 'BENJAMIN ANTWI',   employee_id: 'G22-D4' },
    ],
  },
  // Reserve pools — members substitute for absent regular gang workers
  {
    gang_code: 'GROUP A',
    specialization: 'Reserve Pool',
    notes: 'Replacement members for absent regular gang workers',
    members: [
      { role: 'docker', full_name: 'ERIC KWASI AZANDO',    employee_id: 'GA-D1' },
      { role: 'docker', full_name: 'KORLEY LORD',           employee_id: 'GA-D2' },
      { role: 'docker', full_name: 'GIDEON ADJEI LARYEA',  employee_id: 'GA-D3' },
      { role: 'docker', full_name: 'EMMANUEL K. GYAMPSON', employee_id: 'GA-D4' },
      { role: 'docker', full_name: 'JUDE EYISON',          employee_id: 'GA-D5' },
    ],
  },
  {
    gang_code: 'GROUP B',
    specialization: 'Reserve Pool',
    notes: 'Replacement members for absent regular gang workers',
    members: [
      { role: 'docker', full_name: 'PRAH YAWSON',           employee_id: 'GB-D1' },
      { role: 'docker', full_name: 'BENEDICT LETSA',        employee_id: 'GB-D2' },
      { role: 'docker', full_name: 'REINDOLF AFOTEY OTOO',  employee_id: 'GB-D3' },
      { role: 'docker', full_name: 'DENNIS KWOFIE',         employee_id: 'GB-D4' },
      { role: 'docker', full_name: 'HENRY ADJEI NUBOUR',    employee_id: 'GB-D5' },
    ],
  },
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const g of GANGS) {
    const existing = await prisma.gang.findUnique({ where: { gang_code: g.gang_code } });
    if (existing) {
      console.log(`  skip  ${g.gang_code} (already exists)`);
      skipped++;
      continue;
    }

    await prisma.gang.create({
      data: {
        gang_code:            g.gang_code,
        specialization:       g.specialization || null,
        notes:                g.notes || null,
        status:               'available',
        performance_score:    100.0,
        total_jobs_completed: 0,
        members: {
          create: g.members.map(m => ({ ...m, is_active: true, status: 'available' })),
        },
      },
    });

    console.log(`  created ${g.gang_code} (${g.members.length} members)`);
    created++;
  }

  console.log('');
  console.log(`Done. ${created} gangs created, ${skipped} skipped.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
