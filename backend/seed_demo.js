/**
 * Comprehensive seed script – 4 real Bosnian football clubs
 * FK Sarajevo · HŠK Zrinjski Mostar · FK Željezničar · FK Sloboda Tuzla
 */
'use strict';

const pool   = require('./config/db');
const bcrypt = require('bcryptjs');

// Pre-hashed "password123" (bcrypt, cost 10)
const PW = '$2b$10$IFuIP4EopeLeKlR/.w80dOo8nUz88T6ndownXXrKv.imQD1N.nqD2';

// ─── Helpers ───────────────────────────────────────────────────────────────
function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }
function dateStr(d) { return d.toISOString().slice(0, 10); }
function pastDate(daysAgo) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); return d;
}
function futureDate(daysAhead) {
  const d = new Date(); d.setDate(d.getDate() + daysAhead); return d;
}

// ─── Club definitions ──────────────────────────────────────────────────────
const CLUBS = [
  {
    id: 1,
    name: 'FK Sarajevo',
    slug: 'fk-sarajevo',
    city: 'Sarajevo',
    primary_color: '#C8102E',
    secondary_color: '#FFFFFF',
    logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/FK_Sarajevo_logo.svg/200px-FK_Sarajevo_logo.svg.png',
    adminName: 'Amar Hodžić', adminEmail: 'admin@fksarajevo.ba',
    coaches: [
      { name: 'Husref Musemić',   email: 'musemic@fksarajevo.ba',   spec: 'Glavni trener',        bio: 'Dugogodišnji trener FK Sarajevo sa bogatim iskustvom u Premijer ligi BiH.' },
      { name: 'Samir Bekrić',     email: 'bekric@fksarajevo.ba',    spec: 'Pomoćni trener',       bio: 'Specijalist za kondicijsku pripremu i analizu protivnika.' },
      { name: 'Eldin Jakupović',  email: 'jakupovic@fksarajevo.ba', spec: 'Trener golmana',       bio: 'Bivši prvoligaški golman, sada predvodi trening golmana kluba.' },
    ],
    members: [
      { name: 'Armin Hodžić',    pos: 'Golman',         jer: 1,  dob: '1998-03-12' },
      { name: 'Haris Handžić',   pos: 'Desni bek',      jer: 2,  dob: '1999-07-22' },
      { name: 'Nermin Zuković',  pos: 'Stoper',         jer: 3,  dob: '1997-11-05' },
      { name: 'Kenan Pirić',     pos: 'Stoper',         jer: 4,  dob: '2000-02-14' },
      { name: 'Damir Kojić',     pos: 'Lijevi bek',     jer: 5,  dob: '1998-09-30' },
      { name: 'Senad Lulić',     pos: 'Centralni vez',  jer: 6,  dob: '1996-06-18' },
      { name: 'Emir Ibišević',   pos: 'Napadač',        jer: 7,  dob: '1995-12-01' },
      { name: 'Tarik Mujičić',   pos: 'Centralni vez',  jer: 8,  dob: '1999-04-25' },
      { name: 'Adnan Rahić',     pos: 'Napadač',        jer: 9,  dob: '2001-08-11' },
      { name: 'Zlatan Đurić',    pos: 'Ofenzivni vez',  jer: 10, dob: '1997-01-07' },
      { name: 'Mirza Tešnjak',   pos: 'Krilni igrač',   jer: 11, dob: '2000-05-19' },
      { name: 'Dino Selimović',  pos: 'Desni bek',      jer: 12, dob: '1999-10-08' },
      { name: 'Amar Hasić',      pos: 'Defanzivni vez', jer: 13, dob: '1998-03-28' },
      { name: 'Jasmin Mušić',    pos: 'Krilni igrač',   jer: 14, dob: '2002-07-03' },
      { name: 'Vedran Kahrić',   pos: 'Stoper',         jer: 15, dob: '1996-09-17' },
    ],
    opponents: ['NK Čelik Zenica','FK Tuzla City','FK Velež Mostar','HŠK Zrinjski Mostar','NK Olimpic','FK Radnik Bijeljina','FK Sloboda Tuzla','FK Željezničar'],
    plan: 'pro',
    monthlyFee: 80,
  },
  {
    id: 2,
    name: 'HŠK Zrinjski Mostar',
    slug: 'hsk-zrinjski',
    city: 'Mostar',
    primary_color: '#003DA5',
    secondary_color: '#FFFFFF',
    logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/03/HSK_Zrinjski_Mostar.png/200px-HSK_Zrinjski_Mostar.png',
    adminName: 'Mario Jurić',    adminEmail: 'admin@hskzrinjski.ba',
    coaches: [
      { name: 'Dario Marić',      email: 'maric@hskzrinjski.ba',    spec: 'Glavni trener',        bio: 'Trener sa licencom UEFA Pro, vodio Zrinjski do titule.' },
      { name: 'Ivan Filipović',   email: 'filipovic@hskzrinjski.ba', spec: 'Kondicioni trener',    bio: 'Stručnjak za fizičku pripremu vrhunskih sportaša.' },
      { name: 'Josip Brkić',      email: 'brkic@hskzrinjski.ba',    spec: 'Trener omladine',      bio: 'Dugogodišnji rad s juniorskim kategorijama.' },
    ],
    members: [
      { name: 'Luka Bilobrk',     pos: 'Golman',         jer: 1,  dob: '1997-04-14' },
      { name: 'Zvonimir Šarlija', pos: 'Desni bek',      jer: 2,  dob: '2000-01-23' },
      { name: 'Nikola Bilić',     pos: 'Stoper',         jer: 3,  dob: '1998-06-07' },
      { name: 'Josip Kvesić',     pos: 'Stoper',         jer: 4,  dob: '1999-11-19' },
      { name: 'Ivan Ćavar',       pos: 'Lijevi bek',     jer: 5,  dob: '2001-03-02' },
      { name: 'Mario Štefulj',    pos: 'Defanzivni vez', jer: 6,  dob: '1997-08-28' },
      { name: 'Josip Milić',      pos: 'Napadač',        jer: 7,  dob: '1996-12-15' },
      { name: 'Dario Perić',      pos: 'Centralni vez',  jer: 8,  dob: '2000-05-04' },
      { name: 'Ante Ćorić',       pos: 'Napadač',        jer: 9,  dob: '2002-09-11' },
      { name: 'Ivan Santini',     pos: 'Ofenzivni vez',  jer: 10, dob: '1998-02-21' },
      { name: 'Zvonimir Ivanković',pos:'Krilni igrač',   jer: 11, dob: '2001-07-17' },
      { name: 'Luka Menalo',      pos: 'Desni bek',      jer: 12, dob: '1999-10-30' },
      { name: 'Kristijan Lovrić', pos: 'Centralni vez',  jer: 13, dob: '2003-04-08' },
      { name: 'Mario Vranješ',    pos: 'Stoper',         jer: 14, dob: '1997-01-25' },
      { name: 'Stipe Biuk',       pos: 'Krilni igrač',   jer: 15, dob: '2001-06-12' },
    ],
    opponents: ['FK Sarajevo','FK Željezničar','FK Sloboda Tuzla','NK Čelik Zenica','FK Tuzla City','NK Vitez','NK Travnik','FK Borac Banja Luka'],
    plan: 'klub',
    monthlyFee: 100,
  },
  {
    id: 3,
    name: 'FK Željezničar',
    slug: 'fk-zeljeznicar',
    city: 'Sarajevo',
    primary_color: '#003399',
    secondary_color: '#FFFFFF',
    logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/60/FK_%C5%BDeljezni%C4%8Dar_logo.svg/200px-FK_%C5%BDeljezni%C4%8Dar_logo.svg.png',
    adminName: 'Nermin Bešić',   adminEmail: 'admin@fkzeljeznicar.ba',
    coaches: [
      { name: 'Admir Vladavić',   email: 'vladavic@fkzeljeznicar.ba', spec: 'Glavni trener',      bio: 'Bivši kapiten Željezničara, sada vodi prvu ekipu kluba.' },
      { name: 'Sadin Šipoš',      email: 'sipos@fkzeljeznicar.ba',    spec: 'Pomoćni trener',     bio: 'Specijalist za analitiku utakmica i taktičku pripremu.' },
      { name: 'Muhamed Jusić',    email: 'jusic@fkzeljeznicar.ba',     spec: 'Trener portira',     bio: 'UEFA A licenca, specijalista za trening golmana.' },
    ],
    members: [
      { name: 'Almir Bekić',      pos: 'Golman',         jer: 1,  dob: '1998-05-10' },
      { name: 'Faruk Saračević',  pos: 'Desni bek',      jer: 2,  dob: '2000-09-14' },
      { name: 'Sven Spahić',      pos: 'Stoper',         jer: 3,  dob: '1997-03-28' },
      { name: 'Haris Đuvić',      pos: 'Stoper',         jer: 4,  dob: '1999-12-03' },
      { name: 'Ismar Šehović',    pos: 'Lijevi bek',     jer: 5,  dob: '2001-07-22' },
      { name: 'Eldin Adilović',   pos: 'Defanzivni vez', jer: 6,  dob: '1996-10-17' },
      { name: 'Kerim Memić',      pos: 'Napadač',        jer: 7,  dob: '1999-02-05' },
      { name: 'Danijel Šarić',    pos: 'Centralni vez',  jer: 8,  dob: '2000-06-30' },
      { name: 'Bojan Pavlović',   pos: 'Napadač',        jer: 9,  dob: '1997-11-18' },
      { name: 'Rijad Bajić',      pos: 'Ofenzivni vez',  jer: 10, dob: '1996-04-12' },
      { name: 'Šemso Hodzić',     pos: 'Krilni igrač',   jer: 11, dob: '2002-08-25' },
      { name: 'Muris Mesanović',  pos: 'Desni bek',      jer: 12, dob: '1999-01-06' },
      { name: 'Semir Kuduzović',  pos: 'Centralni vez',  jer: 13, dob: '2001-03-19' },
      { name: 'Žarko Jovetić',    pos: 'Stoper',         jer: 14, dob: '1998-09-07' },
      { name: 'Alen Šišić',       pos: 'Krilni igrač',   jer: 15, dob: '2000-11-29' },
    ],
    opponents: ['FK Sarajevo','HŠK Zrinjski Mostar','FK Sloboda Tuzla','FK Velež Mostar','NK Čelik Zenica','FK Borac Banja Luka','FK Rudar Prijedor','NK Olimpic'],
    plan: 'pro',
    monthlyFee: 80,
  },
  {
    id: 4,
    name: 'FK Sloboda Tuzla',
    slug: 'fk-sloboda-tuzla',
    city: 'Tuzla',
    primary_color: '#CC0000',
    secondary_color: '#000000',
    logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/39/FK_Sloboda_Tuzla.png/200px-FK_Sloboda_Tuzla.png',
    adminName: 'Anel Muratović',  adminEmail: 'admin@fksloboda.ba',
    coaches: [
      { name: 'Edhem Hadžić',     email: 'hadzic@fksloboda.ba',   spec: 'Glavni trener',          bio: 'Trener sa višegodišnjim iskustvom u bh. fudbalu, bivši reprezentativac.' },
      { name: 'Almir Šehić',      email: 'sehic@fksloboda.ba',    spec: 'Kondicioni trener',       bio: 'Magistar sportskih nauka, stručnjak za fizičku pripremu.' },
      { name: 'Denis Zukić',      email: 'zukic@fksloboda.ba',    spec: 'Trener mladih',           bio: 'Radi s juniorima U-19 i potiče lokalne talente.' },
    ],
    members: [
      { name: 'Amer Šišić',       pos: 'Golman',         jer: 1,  dob: '1999-06-08' },
      { name: 'Ermin Kahrimanović',pos:'Desni bek',       jer: 2,  dob: '2001-10-17' },
      { name: 'Haso Šantić',      pos: 'Stoper',         jer: 3,  dob: '1998-04-02' },
      { name: 'Mirnes Mujić',     pos: 'Stoper',         jer: 4,  dob: '2000-08-29' },
      { name: 'Eldin Terzić',     pos: 'Lijevi bek',     jer: 5,  dob: '1997-01-16' },
      { name: 'Nermin Čančar',    pos: 'Defanzivni vez', jer: 6,  dob: '1999-05-23' },
      { name: 'Andelko Đurić',    pos: 'Napadač',        jer: 7,  dob: '1996-11-11' },
      { name: 'Edin Šehić',       pos: 'Centralni vez',  jer: 8,  dob: '2001-03-07' },
      { name: 'Senadin Begić',    pos: 'Napadač',        jer: 9,  dob: '2000-12-24' },
      { name: 'Haris Suljić',     pos: 'Ofenzivni vez',  jer: 10, dob: '1998-07-15' },
      { name: 'Samir Handžić',    pos: 'Krilni igrač',   jer: 11, dob: '2002-02-18' },
      { name: 'Aldin Beganović',  pos: 'Desni bek',      jer: 12, dob: '1999-09-03' },
      { name: 'Jasmin Ćosić',     pos: 'Centralni vez',  jer: 13, dob: '2001-06-14' },
      { name: 'Kenan Šišić',      pos: 'Stoper',         jer: 14, dob: '1997-08-21' },
      { name: 'Nihad Alibašić',   pos: 'Krilni igrač',   jer: 15, dob: '2003-04-10' },
    ],
    opponents: ['FK Sarajevo','HŠK Zrinjski Mostar','FK Željezničar','NK Čelik Zenica','FK Radnik Bijeljina','FK Tuzla City','FK Borac Banja Luka','NK Travnik'],
    plan: 'starter',
    monthlyFee: 60,
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────
async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    console.log('🗑  Clearing existing club data …');

    // Disable FK checks to allow truncation
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of [
      'player_stats','training_attendance','training_sessions',
      'membership_fees','matches','finances','equipment','sponsors',
      'announcements','notifications','selections',
      'coaches','members',
      'club_subscriptions',
    ]) {
      await conn.query(`DELETE FROM ${t}`);
    }
    // Delete non-super-admin users
    await conn.query("DELETE FROM users WHERE role != 'super_admin'");
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Reset auto-increment counters so IDs start cleanly
    for (const t of [
      'player_stats','training_attendance','training_sessions',
      'membership_fees','matches','finances','equipment','sponsors',
      'announcements','notifications','selections',
      'coaches','members','club_subscriptions',
    ]) {
      await conn.query(`ALTER TABLE ${t} AUTO_INCREMENT = 1`);
    }

    console.log('✅  Cleared.\n');

    for (const club of CLUBS) {
      console.log(`🏟  Seeding ${club.name} …`);

      // ── 1. Update club row ───────────────────────────────────────────────
      await conn.query(
        `UPDATE clubs SET name=?, slug=?, city=?, primary_color=?, secondary_color=?, logo_url=?, is_active=1 WHERE id=?`,
        [club.name, club.slug, club.city, club.primary_color, club.secondary_color, club.logo_url, club.id]
      );

      // ── 2. Club subscription ─────────────────────────────────────────────
      const planPrices = { starter: 0, pro: 40, klub: 60 };
      await conn.query(
        `INSERT INTO club_subscriptions (club_id,plan,price,billing_cycle,status,current_period_start,current_period_end,notes)
         VALUES (?,?,?,'monthly','active',?,?,?)`,
        [
          club.id, club.plan, planPrices[club.plan],
          dateStr(new Date('2026-01-01')),
          dateStr(new Date('2026-12-31')),
          `Pretplata za ${club.name} – ${club.plan} plan`
        ]
      );

      // ── 3. Admin user ────────────────────────────────────────────────────
      const [adminRes] = await conn.query(
        `INSERT INTO users (name,email,password_hash,role,is_active,club_id,phone,email_verified)
         VALUES (?,?,?,'admin',1,?,?,1)`,
        [club.adminName, club.adminEmail, PW, club.id, '+387 61 ' + rnd(100000,999999)]
      );
      const adminId = adminRes.insertId;

      // ── 4. Selections ────────────────────────────────────────────────────
      const selNames = ['Prva ekipa','Rezervna ekipa','U-21'];
      const selIds = [];
      for (const sn of selNames) {
        const [sr] = await conn.query(
          `INSERT INTO selections (club_id,name,description) VALUES (?,?,?)`,
          [club.id, sn, `${sn} – ${club.name}`]
        );
        selIds.push(sr.insertId);
      }

      // ── 5. Coaches ───────────────────────────────────────────────────────
      const coachUserIds = [];
      for (const c of club.coaches) {
        const [ur] = await conn.query(
          `INSERT INTO users (name,email,password_hash,role,is_active,club_id,phone,email_verified)
           VALUES (?,?,?,'coach',1,?,?,1)`,
          [c.name, c.email, PW, club.id, '+387 62 ' + rnd(100000,999999)]
        );
        const [cr] = await conn.query(
          `INSERT INTO coaches (user_id,specialization,phone,bio,club_id,selection_id)
           VALUES (?,?,?,?,?,?)`,
          [ur.insertId, c.spec, '+387 62 ' + rnd(100000,999999), c.bio, club.id, selIds[0]]
        );
        coachUserIds.push({ userId: ur.insertId, coachId: cr.insertId });
      }

      // ── 6. Members ───────────────────────────────────────────────────────
      const memberIds = [];
      for (let i = 0; i < club.members.length; i++) {
        const m = club.members[i];
        const selId = i < 11 ? selIds[0] : selIds[1]; // first 11 in main team
        const memNum = `${club.id}${String(i+1).padStart(3,'0')}`;
        const email = `${m.name.toLowerCase().replace(/[^a-z]/g,'').slice(0,8)}${i+1}@${club.slug}.ba`;
        const joinDate = dateStr(pastDate(rnd(100, 800)));

        const [ur] = await conn.query(
          `INSERT INTO users (name,email,password_hash,role,is_active,club_id,phone,email_verified)
           VALUES (?,?,?,'member',1,?,?,1)`,
          [m.name, email, PW, club.id, '+387 61 ' + rnd(100000,999999)]
        );
        const [mr] = await conn.query(
          `INSERT INTO members (user_id,membership_number,phone,date_of_birth,address,join_date,status,club_id,selection_id,position,jersey_number)
           VALUES (?,?,?,?,?,?,'active',?,?,?,?)`,
          [
            ur.insertId, memNum,
            '+387 61 ' + rnd(100000,999999),
            m.dob,
            `ul. Braće ${m.name.split(' ')[1] || 'Hasić'} bb, ${club.city}`,
            joinDate, club.id, selId, m.pos, m.jer
          ]
        );
        memberIds.push(mr.insertId);
      }

      // ── 7. Matches (12 past + 3 future) ─────────────────────────────────
      const matchIds = [];
      const matchTypes = ['league','league','league','league','cup','friendly'];
      const formations = ['4-3-3','4-2-3-1','3-5-2','4-4-2'];

      for (let i = 0; i < 12; i++) {
        const isHome = i % 2 === 0;
        const opponent = club.opponents[i % club.opponents.length];
        const daysAgo = (12 - i) * 14; // every 2 weeks
        const gFor   = rnd(0, 4);
        const gAgainst = rnd(0, 3);
        const result = gFor > gAgainst ? 'win' : gFor < gAgainst ? 'loss' : 'draw';
        const [mr] = await conn.query(
          `INSERT INTO matches (club_id,opponent,location,match_date,match_type,home_away,result,goals_for,goals_against,notes,selection_id,formation)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            club.id, opponent,
            isHome ? `Stadion ${club.name}, ${club.city}` : `Gostujući stadion, ${opponent}`,
            pastDate(daysAgo),
            pick(matchTypes),
            isHome ? 'home' : 'away',
            result, gFor, gAgainst,
            `Utakmica ${i+1}. kola Premijer lige BiH. Nastup u formaciji ${pick(formations)}.`,
            selIds[0], pick(formations)
          ]
        );
        matchIds.push({ id: mr.insertId, gFor, gAgainst });
      }

      // 3 upcoming matches
      for (let i = 0; i < 3; i++) {
        await conn.query(
          `INSERT INTO matches (club_id,opponent,location,match_date,match_type,home_away,result,goals_for,goals_against,notes,selection_id,formation)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            club.id,
            club.opponents[(i + 2) % club.opponents.length],
            i % 2 === 0 ? `Stadion ${club.name}, ${club.city}` : `Gostujući stadion`,
            futureDate((i + 1) * 7),
            pick(matchTypes),
            i % 2 === 0 ? 'home' : 'away',
            'pending', null, null,
            'Predstojeća utakmica – raspored potvrđen.',
            selIds[0], null
          ]
        );
      }

      // ── 8. Player stats for past matches ────────────────────────────────
      for (const match of matchIds) {
        // Random 11 starters + 3 subs from memberIds
        const shuffled = [...memberIds].sort(() => Math.random() - 0.5);
        const starters = shuffled.slice(0, 11);
        const subs     = shuffled.slice(11, 14);

        let goalsLeft = match.gFor;
        for (let j = 0; j < starters.length; j++) {
          const isStriker = j >= 8; // positions 9-11 are forwards
          const goals   = isStriker && goalsLeft > 0 ? (goalsLeft > 1 ? rnd(0,Math.min(goalsLeft,2)) : rnd(0,1)) : rnd(0,1) < 0 ? 1 : 0;
          const scored  = j < 3 && goalsLeft > 0 ? 1 : goals;
          goalsLeft     = Math.max(0, goalsLeft - scored);
          await conn.query(
            `INSERT INTO player_stats (member_id,match_id,club_id,goals,assists,yellow_cards,red_cards,minutes_played,started)
             VALUES (?,?,?,?,?,?,?,?,1)`,
            [
              starters[j], match.id, club.id,
              scored,
              rnd(0, 1),
              rnd(0, 1) === 1 ? 1 : 0,
              0,
              rnd(60, 90)
            ]
          );
        }
        for (const sub of subs) {
          await conn.query(
            `INSERT INTO player_stats (member_id,match_id,club_id,goals,assists,yellow_cards,red_cards,minutes_played,started)
             VALUES (?,?,?,?,?,?,?,?,0)`,
            [sub, match.id, club.id, 0, 0, 0, 0, rnd(15, 45)]
          );
        }
      }

      // ── 9. Training sessions (10) ─────────────────────────────────────────
      const sessionIds = [];
      const trainingTitles = [
        'Tehničko-taktički trening','Kondicioni trening','Trening finalizacije',
        'Trening obrane','Trening slobodnih udaraca','Regenerativni trening',
        'Trening u malim grupama','Analiza utakmice – video','Trening standardnih situacija','Regeneracija i istezanje',
      ];
      for (let i = 0; i < 10; i++) {
        const dAgo   = (10 - i) * 5;
        const status = dAgo > 0 ? 'completed' : 'scheduled';
        const [tr] = await conn.query(
          `INSERT INTO training_sessions (coach_id,title,description,location,session_date,start_time,end_time,max_participants,status,club_id,selection_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            coachUserIds[i % coachUserIds.length].coachId,
            trainingTitles[i],
            `${trainingTitles[i]} u sklopu priprema za narednu utakmicu.`,
            `Trening centar ${club.name}, ${club.city}`,
            dateStr(pastDate(dAgo)),
            '10:00:00','12:00:00', 20, status, club.id, selIds[0]
          ]
        );
        sessionIds.push(tr.insertId);
      }

      // ── 10. Training attendance ──────────────────────────────────────────
      for (const sid of sessionIds) {
        for (const mid of memberIds) {
          const rand = Math.random();
          const status = rand < 0.75 ? 'present' : rand < 0.90 ? 'absent' : 'excused';
          await conn.query(
            `INSERT INTO training_attendance (session_id,member_id,status) VALUES (?,?,?)`,
            [sid, mid, status]
          );
        }
      }

      // ── 11. Membership fees (6 months: Dec 2025 – May 2026) ─────────────
      const feeMonths = [
        { ps: '2025-12-01', pe: '2025-12-31', due: '2025-12-10', paid: '2025-12-08', status: 'paid'    },
        { ps: '2026-01-01', pe: '2026-01-31', due: '2026-01-10', paid: '2026-01-09', status: 'paid'    },
        { ps: '2026-02-01', pe: '2026-02-28', due: '2026-02-10', paid: '2026-02-11', status: 'paid'    },
        { ps: '2026-03-01', pe: '2026-03-31', due: '2026-03-10', paid: '2026-03-10', status: 'paid'    },
        { ps: '2026-04-01', pe: '2026-04-30', due: '2026-04-10', paid: null,         status: 'overdue' },
        { ps: '2026-05-01', pe: '2026-05-31', due: '2026-05-10', paid: null,         status: 'pending' },
      ];
      const payMethods = ['Gotovina','Bankovna transakcija','Online plaćanje','Kartica'];

      for (const mid of memberIds) {
        for (const fm of feeMonths) {
          // Some members have overdue, some paid
          const late = Math.random() < 0.15;
          const actualStatus = fm.status === 'paid' && late ? 'overdue' : fm.status;
          const paidDate = actualStatus === 'paid' ? fm.paid : null;
          await conn.query(
            `INSERT INTO membership_fees (member_id,amount,period_start,period_end,due_date,paid_date,status,payment_method,notes,created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [
              mid, club.monthlyFee, fm.ps, fm.pe, fm.due,
              paidDate, actualStatus,
              paidDate ? pick(payMethods) : null,
              `Članarina za ${fm.ps.slice(0,7)} – ${club.name}`,
              adminId
            ]
          );
        }
      }

      // ── 12. Finances ──────────────────────────────────────────────────────
      const financeData = [
        // Income
        { type:'income', cat:'Sponzorstvo',       desc:'Prihod od glavnog sponzora',                  amt: 15000,  date: '2026-01-15' },
        { type:'income', cat:'Sponzorstvo',       desc:'Prihod od sekundarnog sponzora',              amt: 7500,   date: '2026-01-20' },
        { type:'income', cat:'Članarine',         desc:'Ukupne uplaćene članarine – januar 2026',     amt: club.members.length * club.monthlyFee * 0.85, date: '2026-01-31' },
        { type:'income', cat:'Ulaznice',          desc:'Prihod od ulaznica – domaće utakmice',        amt: 3200,   date: '2026-02-10' },
        { type:'income', cat:'Donacija',          desc:'Donacija Općine/Grada',                       amt: 5000,   date: '2026-02-14' },
        { type:'income', cat:'Sponzorstvo',       desc:'Prihod od tehničkog sponzora',                amt: 4000,   date: '2026-03-01' },
        { type:'income', cat:'Članarine',         desc:'Ukupne uplaćene članarine – februar 2026',    amt: club.members.length * club.monthlyFee * 0.90, date: '2026-02-28' },
        { type:'income', cat:'Transferi',         desc:'Transfer igrača – odšteta',                   amt: 8000,   date: '2026-03-15' },
        { type:'income', cat:'Članarine',         desc:'Ukupne uplaćene članarine – mart 2026',       amt: club.members.length * club.monthlyFee * 0.92, date: '2026-03-31' },
        { type:'income', cat:'Ulaznice',          desc:'Prihod od ulaznica – mart',                   amt: 2800,   date: '2026-03-28' },
        { type:'income', cat:'Donacija',          desc:'Donacija FK navijačkog kluba',                amt: 1500,   date: '2026-04-05' },
        { type:'income', cat:'Članarine',         desc:'Ukupne uplaćene članarine – april 2026',      amt: club.members.length * club.monthlyFee * 0.78, date: '2026-04-30' },
        // Expenses
        { type:'expense', cat:'Plate',            desc:'Plate igrača i trenera – januar',             amt: 18000,  date: '2026-01-31' },
        { type:'expense', cat:'Oprema',           desc:'Nabavka sportske opreme i dresova',           amt: 3500,   date: '2026-02-05' },
        { type:'expense', cat:'Putni troškovi',   desc:'Troškovi putovanja na gostujuće utakmice',    amt: 1200,   date: '2026-02-08' },
        { type:'expense', cat:'Plate',            desc:'Plate igrača i trenera – februar',            amt: 18000,  date: '2026-02-28' },
        { type:'expense', cat:'Komunalije',       desc:'Električna energija i voda – trening centar', amt: 450,    date: '2026-02-20' },
        { type:'expense', cat:'Održavanje',       desc:'Održavanje terena i infrastrukture',          amt: 800,    date: '2026-03-10' },
        { type:'expense', cat:'Plate',            desc:'Plate igrača i trenera – mart',               amt: 18500,  date: '2026-03-31' },
        { type:'expense', cat:'Medicinska njega', desc:'Fizioterapija i medicinski pregledi',         amt: 600,    date: '2026-03-25' },
        { type:'expense', cat:'Putni troškovi',   desc:'Putni troškovi – april',                      amt: 950,    date: '2026-04-12' },
        { type:'expense', cat:'Plate',            desc:'Plate igrača i trenera – april',              amt: 18500,  date: '2026-04-30' },
        { type:'expense', cat:'Oprema',           desc:'Popravak i obnova opreme',                    amt: 700,    date: '2026-04-18' },
        { type:'expense', cat:'Marketing',        desc:'Promotivni materijali i web stranica',        amt: 350,    date: '2026-05-02' },
      ];

      for (let fi = 0; fi < financeData.length; fi++) {
        const f = financeData[fi];
        await conn.query(
          `INSERT INTO finances (club_id,type,category,description,amount,date,reference,created_by)
           VALUES (?,?,?,?,?,?,?,?)`,
          [club.id, f.type, f.cat, f.desc, f.amt.toFixed(2), f.date, `REF-${club.id}-${String(fi+1).padStart(4,'0')}`, adminId]
        );
      }

      // ── 13. Equipment ─────────────────────────────────────────────────────
      const equipmentItems = [
        { name: 'Dres (set 16 komada)',     type: 'Dresovi',     qty: 16, cond: 'good',  notes: 'Sezona 2025/2026 – domaći dresovi' },
        { name: 'Dres (set 16 komada)',     type: 'Dresovi',     qty: 16, cond: 'good',  notes: 'Sezona 2025/2026 – gostujući dresovi' },
        { name: 'Lopta Adidas Finale',      type: 'Lopte',       qty: 10, cond: 'good',  notes: 'Zvanična lopta Premijer lige BiH' },
        { name: 'Lopta trening',            type: 'Lopte',       qty: 20, cond: 'fair',  notes: 'Za dnevne treninge' },
        { name: 'Golmanski rukavice',       type: 'Golmanska opr.',qty:4, cond: 'good',  notes: 'Professional grade' },
        { name: 'Štucne (30 pari)',         type: 'Odjeća',      qty: 30, cond: 'good',  notes: 'Različite veličine' },
        { name: 'Kopačke (kompleti)',       type: 'Obuća',       qty: 5,  cond: 'fair',  notes: 'Rezervne kopačke u spremi' },
        { name: 'Trening kone (20 kom)',    type: 'Trening opr.', qty: 20, cond: 'good', notes: 'Plastični konusi za vježbe' },
        { name: 'Kordinaciona ljestve',     type: 'Trening opr.', qty: 4,  cond: 'good', notes: 'Za agilnost i koordinaciju' },
        { name: 'Medicinska torbica',       type: 'Medicinska',   qty: 2,  cond: 'good', notes: 'Prva pomoć na terenu' },
        { name: 'Klupa za zagrijavanje',    type: 'Infrastruktura',qty:1,  cond: 'fair', notes: 'Klupa za zamjene na utakmicama' },
        { name: 'Prsluk (20 kom)',          type: 'Trening opr.', qty: 20, cond: 'good', notes: 'Za trening podjele timova' },
      ];

      for (const eq of equipmentItems) {
        const assignedTo = Math.random() < 0.5 ? memberIds[rnd(0, memberIds.length-1)] : null;
        await conn.query(
          `INSERT INTO equipment (club_id,name,type,quantity,assigned_to,item_condition,notes)
           VALUES (?,?,?,?,?,?,?)`,
          [club.id, eq.name, eq.type, eq.qty, assignedTo, eq.cond, eq.notes]
        );
      }

      // ── 14. Sponsors ───────────────────────────────────────────────────────
      const sponsors = [
        {
          name: 'BH Telecom', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/BH_Telecom.svg/200px-BH_Telecom.svg.png',
          website: 'https://www.bhtelecom.ba', contact: 'Adnan Kahrić', email: 'sponzori@bhtelecom.ba',
          amount: 25000, type: 'main', notes: 'Glavni sponzor – telekomunikacijski paket'
        },
        {
          name: 'Bosnalijek', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Bosnalijek_logo.svg/200px-Bosnalijek_logo.svg.png',
          website: 'https://www.bosnalijek.com', contact: 'Emina Brkić', email: 'marketing@bosnalijek.com',
          amount: 10000, type: 'secondary', notes: 'Medicinska podrška timu'
        },
        {
          name: 'Konzum BiH', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Konzum_logo.svg/200px-Konzum_logo.svg.png',
          website: 'https://www.konzum.ba', contact: 'Mirna Jurić', email: 'sponzorstvo@konzum.ba',
          amount: 8000, type: 'secondary', notes: 'Prehrambeni i tehničko-logistički sponzor'
        },
        {
          name: 'Nike BiH distribucija', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/200px-Logo_NIKE.svg.png',
          website: 'https://www.nike.com', contact: 'Ivica Perić', email: 'sport@nike.ba',
          amount: 12000, type: 'technical', notes: 'Službeni dobavljač sportske opreme'
        },
      ];

      for (const sp of sponsors) {
        await conn.query(
          `INSERT INTO sponsors (club_id,name,logo_url,website,contact_name,contact_email,amount,type,active,notes)
           VALUES (?,?,?,?,?,?,?,?,1,?)`,
          [club.id, sp.name, sp.logo, sp.website, sp.contact, sp.email, sp.amount, sp.type, sp.notes]
        );
      }

      // ── 15. Announcements ─────────────────────────────────────────────────
      const announcements = [
        { title: 'Dobrodošlica novim igračima',      content: `${club.name} je zvanično potpisao ugovore s novim igračima za sezonu 2025/26. Dobrodošli u naš klub!`, pinned: 1, daysAgo: 60 },
        { title: 'Raspored treninga za maj 2026',    content: `Objavljujemo raspored treninga za maj 2026. Treninzi se održavaju ponedjeljkom, srijedom i petkom od 10:00h.`, pinned: 1, daysAgo: 14 },
        { title: 'Rezultati – 10. kolo Premijer lige', content: `${club.name} je odigrao sjajnu utakmicu u 10. kolu Premijer lige BiH. Detaljan izvještaj dostupan na web stranici.`, pinned: 0, daysAgo: 21 },
        { title: 'Informacija o kotizacijama',        content: `Podsjetnik: Kotizacije za maj 2026 su dospjele. Molimo članove da izvrše uplatu do 10.05.2026.`, pinned: 1, daysAgo: 7 },
        { title: 'Juniorski turnir – poziv',          content: `${club.name} organizira juniorski turnir 15.06.2026. Prijave do 01.06.2026. Više info u klubu.`, pinned: 0, daysAgo: 3 },
        { title: 'Novi trening centar – otvorenje',   content: `S ponosom objavljujemo otvorenje novog trening centra u ${club.city}. Svi membri su pozvani na svečano otvaranje.`, pinned: 0, daysAgo: 45 },
      ];

      for (const a of announcements) {
        await conn.query(
          `INSERT INTO announcements (club_id,author_id,title,content,pinned,created_at)
           VALUES (?,?,?,?,?,?)`,
          [club.id, adminId, a.title, a.content, a.pinned, pastDate(a.daysAgo)]
        );
      }

      // ── 16. Notifications ─────────────────────────────────────────────────
      const notifs = [
        { title: 'Dobrodošli u Klavio!',     message: `Sistem upravljanja za ${club.name} je aktivan.`, type: 'success', uid: adminId,    daysAgo: 30 },
        { title: 'Neplaćene kotizacije',     message: '3 člana imaju dospjele neplaćene kotizacije.',     type: 'warning', uid: adminId,    daysAgo: 5  },
        { title: 'Nova utakmica zakazana',   message: `Utakmica ${club.name} zakazana za narednu sedmicu.`, type: 'info',  uid: adminId,    daysAgo: 2  },
        { title: 'Trening otkazan',          message: 'Trening u utorak 13.05.2026 je otkazan.',           type: 'danger', uid: coachUserIds[0].userId, daysAgo: 1 },
      ];
      for (const n of notifs) {
        await conn.query(
          `INSERT INTO notifications (club_id,user_id,title,message,type,is_read,created_at)
           VALUES (?,?,?,?,?,0,?)`,
          [club.id, n.uid, n.title, n.message, n.type, pastDate(n.daysAgo)]
        );
      }

      console.log(`   ✅  ${club.name} seeded – ${memberIds.length} members, ${matchIds.length} matches, ${sessionIds.length} sessions\n`);
    }

    await conn.commit();
    console.log('🎉  All 4 clubs seeded successfully!\n');
    console.log('── Login credentials ────────────────────────────────────────');
    console.log('Super admin:  klavio.app@gmail.com    / admin123');
    for (const c of CLUBS) {
      console.log(`${c.name.padEnd(24)} ${c.adminEmail.padEnd(34)} / password123`);
      console.log(`  Coach:       ${c.coaches[0].email.padEnd(34)} / password123`);
      const m = c.members[0];
      const mEmail = `${m.name.toLowerCase().replace(/[^a-z]/g,'').slice(0,8)}1@${c.slug}.ba`;
      console.log(`  Member:      ${mEmail.padEnd(34)} / password123`);
    }
    console.log('─────────────────────────────────────────────────────────────');

  } catch (err) {
    await conn.rollback();
    console.error('❌  Seed failed:', err);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

seed();
