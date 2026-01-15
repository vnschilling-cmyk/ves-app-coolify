import Tesseract from 'tesseract.js';

export const analyzeImage = async (imageFile, onProgress) => {
    try {
        const { data: { text } } = await Tesseract.recognize(
            imageFile,
            'deu', // German language
            {
                logger: m => {
                    if (onProgress) onProgress(m);
                }
            }
        );
        return text;
    } catch (error) {
        console.error("OCR Error:", error);
        throw new Error("Texterkennung fehlgeschlagen.");
    }
};

export const parseOrderFromText = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const result = {
        company: '',
        id: '',
        value: '',
        date: new Date().toISOString().split('T')[0],
        quantity: '',
        delivery_date: ''
    };

    // Improved Heuristics based on "Johannes Hübner" sample

    // 1. Order ID: "Nummer" followed by digits (e.g. "Nummer 534119")
    // Also keep the generic fallback
    const idRegex = /(?:Nummer|Bestellung|Auftrag)\s*[:#]?\s*(\d{5,})/;
    const idLine = lines.find(l => idRegex.test(l));
    if (idLine) {
        const match = idLine.match(idRegex);
        if (match && match[1]) result.id = match[1];
    }

    // 2. Date: "vom" followed by date (e.g. "vom 09.12.2025")
    const dateRegex = /(?:vom|Datum)\s*[:]?\s*(\d{2}\.\d{2}\.\d{4})/;
    const dateLine = lines.find(l => dateRegex.test(l));
    if (dateLine) {
        const match = dateLine.match(dateRegex);
        if (match && match[1]) {
            const [d, m, y] = match[1].split('.');
            result.date = `${y}-${m}-${d}`;
        }
    }

    // 3. Delivery Date: "Liefertermin ... bis: 14.01.2026"
    const deliveryRegex = /(?:Liefertermin|eintreffend bis)\s*.*[:\s]\s*(\d{2}\.\d{2}\.\d{4})/;
    const deliveryLine = lines.find(l => deliveryRegex.test(l));
    if (deliveryLine) {
        const match = deliveryLine.match(deliveryRegex);
        if (match && match[1]) {
            const [d, m, y] = match[1].split('.');
            result.delivery_date = `${y}-${m}-${d}`;
        }
    }

    // 4. Quantity: Look for "Stück" pattern, e.g. "100 Stück"
    // We prioritize the first occurrence in the items list area roughly
    // Regex found: "100 Stück" anywhere in the line
    const qtyRegex = /(\d+)\s*Stück/i;
    // Scan all lines to find the main quantity line (usually the first one with Stück)
    const qtyLine = lines.find(l => qtyRegex.test(l));
    if (qtyLine) {
        const match = qtyLine.match(qtyRegex);
        if (match && match[1]) result.quantity = match[1];
    }

    // 5. Value: "Gesamtpreis EUR 280,00" or similar.
    let valueFound = false;

    // Strategy A: Explicit "Gesamtpreis" or "Summe" or "Total"
    const labelRegex = /(?:Gesamtpreis|Summe|Rechnungsbetrag|Endbetrag)\s*(?:EUR|€|netto|brutto)?\s*[:]?\s*([\d,.]+)/i;
    const labelLine = lines.find(l => labelRegex.test(l));
    if (labelLine) {
        const match = labelLine.match(labelRegex);
        if (match && match[1]) {
            let valStr = match[1].replace(/\./g, '').replace(',', '.');
            const val = parseFloat(valStr);
            if (!isNaN(val)) {
                result.value = val;
                valueFound = true;
            }
        }
    }

    // Strategy B: If no explicit total label, look at the line with "Stück". 
    // Often the line total is the last number on that line.
    // Example: "01 ID:61972 100 Stück 2,80 280,00"
    if (!valueFound && qtyLine) {
        // Extract all numbers that look like prices from this line
        // Matches 2,80 or 280,00 or 1.280,00
        const priceMatches = qtyLine.match(/(\d{1,3}(?:[.,]\d{3})*(?:,\d{2}))/g);
        if (priceMatches && priceMatches.length > 0) {
            // Usually the last one is the total for that line
            const lastPrice = priceMatches[priceMatches.length - 1];
            let valStr = lastPrice.replace(/\./g, '').replace(',', '.');
            const val = parseFloat(valStr);
            if (!isNaN(val)) {
                result.value = val;
                valueFound = true;
            }
        }
    }

    // Strategy C: Max value strategy (risky but often works for invoices)
    // If we still have nothing, scan for largest currency value at bottom of doc
    if (!valueFound) {
        const moneyRegex = /(\d{1,3}(?:[.,]\d{3})*(?:,\d{2}))\s*(?:€|EUR)?/i;
        let maxVal = 0;
        lines.forEach(line => {
            // Check if line contains currency symbol or looks like a total line
            if (/(?:EUR|€)/.test(line) || /^\s*\d+/.test(line)) {
                const matches = line.matchAll(/(\d{1,3}(?:[.,]\d{3})*(?:,\d{2}))/g);
                for (const match of matches) {
                    let valStr = match[1].replace(/\./g, '').replace(',', '.');
                    const val = parseFloat(valStr);
                    if (!isNaN(val) && val > maxVal) {
                        maxVal = val;
                    }
                }
            }
        });
        if (maxVal > 0) result.value = maxVal;
    }

    // 6. Company: "Johannes Hübner..."
    // Looking for the specific header from sample or standard address block
    const companyRegex = /(?:Johannes Hübner|Schilling & Enns)/i;
    const companyLine = lines.find(l => companyRegex.test(l));
    if (companyLine) {
        // Clean up company name
        result.company = companyLine.replace(/Fabrik.*$/, '').trim();
        if (result.company.includes('Schilling')) result.company = 'Johannes Hübner'; // Logic: if we swipe our own name, maybe we want the other one? 
        // Actually simpler: Just grab the first "GmbH" line if found
        if (!result.company) {
            const gmbhLine = lines.find(l => l.includes('GmbH'));
            if (gmbhLine) result.company = gmbhLine.split('*')[0].trim(); // Remove footer noise
        }
    } else {
        // Fallback: First generic GmbH line
        const gmbhLine = lines.find(l => l.includes('GmbH') || l.includes('AG'));
        if (gmbhLine) result.company = gmbhLine;
    }

    return result;
};
