const bcrypt = require('bcryptjs');
const { getDb } = require('../config/db');

async function seedDatabase() {
    try {
        console.log('Connecting to the database...');
        const pool = await getDb();
        const connection = await pool.getConnection();

        console.log('Seeding data...');

        // 1. Create Doctors
        const passwordHash = await bcrypt.hash('password123', 10);
        
        await connection.query('DELETE FROM users');
        await connection.query('ALTER TABLE users AUTO_INCREMENT = 1');
        
        const [doctor1] = await connection.query(`
            INSERT INTO users (name, email, password_hash, role, hospital_name) 
            VALUES ('Dr. Sarah Jenkins', 'sarah.jenkins@medbrief.ai', ?, 'doctor', 'General Hospital')
        `, [passwordHash]);

        const [doctor2] = await connection.query(`
            INSERT INTO users (name, email, password_hash, role, hospital_name) 
            VALUES ('Dr. Robert Chen', 'robert.chen@medbrief.ai', ?, 'doctor', 'City Medical Center')
        `, [passwordHash]);

        const doc1Id = doctor1.insertId;
        const doc2Id = doctor2.insertId;

        console.log(`Created doctors with IDs: ${doc1Id}, ${doc2Id}`);

        // 2. Create Patients
        await connection.query('DELETE FROM patients');
        await connection.query('ALTER TABLE patients AUTO_INCREMENT = 1');

        const [patient1] = await connection.query(`
            INSERT INTO patients (doctor_id, patient_uid, name, age, gender, medical_history)
            VALUES (?, 'PT-1001', 'Alice Walker', 45, 'Female', 'Hypertension, Type 2 Diabetes')
        `, [doc1Id]);

        const [patient2] = await connection.query(`
            INSERT INTO patients (doctor_id, patient_uid, name, age, gender, medical_history)
            VALUES (?, 'PT-1002', 'Marcus Johnson', 62, 'Male', 'Asthma, previous myocardial infarction (2018)')
        `, [doc1Id]);

        const [patient3] = await connection.query(`
            INSERT INTO patients (doctor_id, patient_uid, name, age, gender, medical_history)
            VALUES (?, 'PT-1003', 'Elena Rodriguez', 28, 'Female', 'No significant past medical history. Allergic to Penicillin.')
        `, [doc2Id]);

        const pat1Id = patient1.insertId;
        const pat2Id = patient2.insertId;
        const pat3Id = patient3.insertId;

        console.log(`Created patients with IDs: ${pat1Id}, ${pat2Id}, ${pat3Id}`);

        // 3. Create Visits
        await connection.query('DELETE FROM visits');
        await connection.query('ALTER TABLE visits AUTO_INCREMENT = 1');
        
        const dummyTranscript = "Doctor: Hi Alice, how have you been feeling since we adjusted your blood pressure medication?\nPatient: Hi Dr. Jenkins. I've been feeling okay, but I sometimes get a little dizzy when I stand up too quickly.\nDoctor: I see. That can be a side effect of the new dosage. Have you been checking your blood pressure at home?\nPatient: Yes, it's usually around 120 over 80 in the mornings.\nDoctor: That's a good reading. We might need to slightly reduce the morning dose to help with the dizziness. I'll write a new prescription. Please make sure to stay hydrated as well.";
        const dummyExtractedData = JSON.stringify({
            "symptoms": ["dizziness on standing"],
            "vitals": {"blood_pressure": "120/80 (home readings)"},
            "medications": ["blood pressure medication (needs adjustment)"],
            "plan": ["Reduce morning dose of BP medication", "Stay hydrated", "New prescription provided"]
        });

        await connection.query(`
            INSERT INTO visits (doctor_id, patient_id, patient_name, visit_date, status, transcript, extracted_data, confidence_score)
            VALUES (?, ?, 'Alice Walker', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'finalized', ?, ?, 0.92)
        `, [doc1Id, pat1Id, dummyTranscript, dummyExtractedData]);

        await connection.query(`
            INSERT INTO visits (doctor_id, patient_id, patient_name, visit_date, status, transcript, extracted_data, confidence_score)
            VALUES (?, ?, 'Marcus Johnson', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'reviewing', 'Doctor: How is the breathing, Marcus?\nPatient: A bit tight lately, doctor. Using the inhaler more often.', '{"symptoms": ["chest tightness", "increased inhaler use"]}', 0.88)
        `, [doc1Id, pat2Id]);
        
        await connection.query(`
            INSERT INTO visits (doctor_id, patient_id, patient_name, visit_date, status, transcript, extracted_data, confidence_score)
            VALUES (?, ?, 'Elena Rodriguez', CURDATE(), 'transcribing', 'Audio currently processing...', null, null)
        `, [doc2Id, pat3Id]);

        console.log('Created visits.');

        connection.release();
        console.log('Seeding completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
