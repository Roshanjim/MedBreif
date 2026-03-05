/**
 * Summary Formatter Service
 * Generates Doctor Summary and Patient-Friendly Summary from extracted data.
 */

function generateDoctorSummary(extractedData) {
    const data = extractedData;

    let summary = `MEDICAL VISIT SUMMARY\n`;
    summary += `${'='.repeat(50)}\n`;
    summary += `Date: ${data.Date || 'Not specified'}\n`;
    summary += `Patient: ${data.PatientName || 'Not specified'}\n\n`;

    summary += `PRESENTING COMPLAINTS:\n`;
    if (data.Symptoms && data.Symptoms.length) {
        data.Symptoms.forEach(s => { summary += `  • ${s}\n`; });
    } else {
        summary += `  • Not Clearly Mentioned\n`;
    }

    summary += `\nDURATION:\n`;
    if (data.Duration && data.Duration.length) {
        data.Duration.forEach(d => { summary += `  • ${d}\n`; });
    } else {
        summary += `  • Not Clearly Mentioned\n`;
    }

    if (data.VitalsRecorded) {
        summary += `\nVITALS:\n`;
        Object.entries(data.VitalsRecorded).forEach(([key, val]) => {
            summary += `  • ${key}: ${val}\n`;
        });
    }

    summary += `\nDIAGNOSIS:\n`;
    if (data.Diagnosis && data.Diagnosis.length) {
        data.Diagnosis.forEach(d => { summary += `  • ${d}\n`; });
    } else {
        summary += `  • Not Clearly Mentioned\n`;
    }

    summary += `\nPRESCRIPTIONS:\n`;
    if (data.Prescriptions && data.Prescriptions.length) {
        data.Prescriptions.forEach((p, i) => {
            summary += `  ${i + 1}. ${p.Medicine} ${p.Dosage} - ${p.Frequency} for ${p.Duration}\n`;
        });
    } else {
        summary += `  • No prescriptions noted\n`;
    }

    summary += `\nTESTS ADVISED:\n`;
    if (data.TestsAdvised && data.TestsAdvised.length) {
        data.TestsAdvised.forEach(t => { summary += `  • ${t}\n`; });
    } else {
        summary += `  • None\n`;
    }

    summary += `\nLIFESTYLE ADVICE:\n`;
    if (data.LifestyleAdvice && data.LifestyleAdvice.length) {
        data.LifestyleAdvice.forEach(l => { summary += `  • ${l}\n`; });
    } else {
        summary += `  • None noted\n`;
    }

    summary += `\nFOLLOW-UP: ${data.FollowUp || 'Not specified'}\n`;

    if (data.RedFlags && data.RedFlags.length) {
        summary += `\n⚠️ RED FLAGS:\n`;
        data.RedFlags.forEach(r => { summary += `  ⚠ ${r}\n`; });
    }

    if (data.UnclearItems && data.UnclearItems.length) {
        summary += `\n❓ UNCLEAR/NOT MENTIONED:\n`;
        data.UnclearItems.forEach(u => { summary += `  ? ${u}\n`; });
    }

    summary += `\nConfidence Score: ${data.ConfidenceScore || 'N/A'}\n`;
    summary += `\n${'─'.repeat(50)}\n`;
    summary += `⚕️ DISCLAIMER: AI-generated summary. Doctor verification required.\n`;

    return summary;
}

function generatePatientSummary(extractedData) {
    const data = extractedData;

    let summary = `Hello! Here's a simple summary of your visit today:\n\n`;

    summary += `📋 WHAT THE DOCTOR FOUND:\n`;
    if (data.Diagnosis && data.Diagnosis.length) {
        data.Diagnosis.forEach(d => { summary += `  Your doctor thinks you may have: ${d}\n`; });
    }

    summary += `\n💊 YOUR MEDICINES:\n`;
    if (data.Prescriptions && data.Prescriptions.length) {
        data.Prescriptions.forEach(p => {
            summary += `  • ${p.Medicine} (${p.Dosage})\n`;
            summary += `    Take: ${p.Frequency}\n`;
            summary += `    For: ${p.Duration}\n\n`;
        });
    }

    summary += `🔬 TESTS YOU NEED:\n`;
    if (data.TestsAdvised && data.TestsAdvised.length) {
        data.TestsAdvised.forEach(t => { summary += `  • ${t}\n`; });
    } else {
        summary += `  • No tests needed\n`;
    }

    summary += `\n🏃 THINGS TO DO:\n`;
    if (data.LifestyleAdvice && data.LifestyleAdvice.length) {
        data.LifestyleAdvice.forEach(l => { summary += `  ✓ ${l}\n`; });
    }

    summary += `\n📅 NEXT VISIT: ${data.FollowUp || 'Your doctor will advise'}\n`;

    if (data.RedFlags && data.RedFlags.length) {
        summary += `\n🚨 IMPORTANT - GO TO HOSPITAL IMMEDIATELY IF:\n`;
        data.RedFlags.forEach(r => { summary += `  ⚠ ${r}\n`; });
    }

    summary += `\n---\n`;
    summary += `⚕️ This summary was created by AI. Please confirm with your doctor.\n`;

    return summary;
}

module.exports = { generateDoctorSummary, generatePatientSummary };
