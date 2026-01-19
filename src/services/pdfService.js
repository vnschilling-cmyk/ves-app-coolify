import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export const extractTextFromPdf = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
};

export const parsePositionsFromText = (text) => {
    const positions = [];

    // 1. Global Order ID
    const orderIdMatch = text.match(/Nummer\s+(\d+)/i) || text.match(/Auftrag(?:dX|s-Nr\.?)?[:\s]*([A-Z0-9-]+)/i);
    const globalOrderId = orderIdMatch ? orderIdMatch[1] : '';

    // 2. Global Date
    const dateMatch = text.match(/vom\s+(\d{2}\.\d{2}\.\d{4})/i);
    const globalDate = dateMatch ? dateMatch[1].split('.').reverse().join('-') : new Date().toISOString().split('T')[0];

    // 3. Positions Parsing
    const posRegex = /(\d{2})\s+ID:\s+(\d+)([\s\S]+?)(?=\d{2}\s+ID:|$)/g;

    let match;
    while ((match = posRegex.exec(text)) !== null) {
        const posNr = match[1];
        const articleId = match[2];
        const contentBlock = match[3];

        const qtyMatch = contentBlock.match(/(\d+)\s*(?:Stück|Stk|x)/i);
        const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;

        const deliveryMatch = contentBlock.match(/Liefertermin.*?bis:\s*(\d{2}\.\d{2}\.\d{4})/i);
        const deliveryDate = deliveryMatch ? deliveryMatch[1].split('.').reverse().join('-') : '';

        // Remove dates from price search
        const contentWithoutDates = contentBlock.replace(/\d{2}\.\d{2}\.\d{4}/g, '');

        // Broad Regex for Price: Matches 1.234,56 | 42,00 | 2,10
        const pricesMatch = contentWithoutDates.match(/(\d{1,5}(?:[.\s]\d{3})*,\s*\d{1,2})(?!\d)/g);

        let value = 0;
        let unitPrice = 0;

        if (pricesMatch && pricesMatch.length > 0) {
            const parsePrice = (str) => {
                let clean = str.replace(/\s/g, '');
                if (clean.includes(',') && clean.includes('.')) {
                    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
                } else if (clean.includes(',')) {
                    return parseFloat(clean.replace(',', '.'));
                } else {
                    return parseFloat(clean);
                }
            };

            const prices = pricesMatch.map(parsePrice);

            if (prices.length >= 2) {
                // Multiple prices found: Assuming logic [Unit, ..., Total]
                const potentialTotal = prices[prices.length - 1];
                const potentialUnit = prices[0];

                // If math matches roughly, trust it
                if (Math.abs(potentialUnit * quantity - potentialTotal) < 0.1) {
                    value = potentialTotal;
                    unitPrice = potentialUnit;
                } else {
                    // Fallback: Use the largest value found as Total? 
                    // Or check if user prefers CALCULATION based on feedback
                    const minPrice = Math.min(...prices);
                    value = minPrice * quantity;
                    unitPrice = minPrice;
                }
            } else {
                // Single price found
                const p = prices[0];
                if (quantity > 1) {
                    // With >1 qty, a single price is highly likely the Unit Price (e.g. 2.80)
                    // Calculate Total
                    value = p * quantity;
                    unitPrice = p;
                } else {
                    value = p;
                    unitPrice = p;
                }
            }
        }

        let desc = contentBlock
            .replace(/(\d+)\s*(?:Stück|Stk|x)/i, '') // Remove Qty
            .replace(/Liefertermin.*?bis:\s*\d{2}\.\d{2}\.\d{4}/i, '') // Remove Date
            .replace(/(\d{1,5}(?:[.\s]\d{3})*,\s*\d{1,2})(?!\d)/g, '') // Remove prices
            .replace(new RegExp(articleId, 'g'), '') // Remove repeated Article ID
            .replace(/Stück\s+\d+/gi, '') // Remove inverted "Stück 100" artifacts
            .replace(/\s+/g, ' ')
            .trim();

        // Clean up common leading artifacts
        desc = desc.replace(/^[-\s]+/, '');
        desc = desc.replace(/^[0-9]+\s+/, ''); // Remove leading separate numbers often found

        if (desc.length > 80) desc = desc.substring(0, 80) + '...';

        // Extract Drawing Number
        // Improved logic to avoid "gem. Zeichnung" false positives (like "Teile")
        // 1. Look for KT-xxxx pattern specifically (Hübner style)
        let drawingMatch = contentBlock.match(/(?:KT-\d{4,10})/i);
        let drawingNumber = drawingMatch ? drawingMatch[0] : '';

        if (!drawingNumber) {
            // 2. Generic "Zeichnung: ..." search
            // We use a regex that tries to exclude "gem. Zeichnung" by not capturing if preceded by "gem" (approximation via check)
            const genericMatch = contentBlock.match(/(?:Zeichnung|Z\.?-?Nr\.?|Zeichnungsnr\.?|Zchng\.?)\s*[:.]?\s*([A-Z0-9.-]+)/i);

            if (genericMatch) {
                const candidate = genericMatch[1];
                // Filter out known bad words or "gem. Zeichnung" artifacts
                const lower = candidate.toLowerCase();
                const precedingText = contentBlock.substring(0, genericMatch.index).trim();

                const isGemMatch = precedingText.endsWith('gem.') || precedingText.endsWith('gem');
                const isBadWord = ['teile', 'an', 'gemaess', 'gem'].includes(lower);

                if (!isGemMatch && !isBadWord && candidate.length > 2) {
                    drawingNumber = candidate;
                }
            }
        }

        // Final fallback: Look for "Zeichnung" followed by a number that appears LATER in the block than "Teile"
        if (!drawingNumber && contentBlock.includes('Zeichnung')) {
            const parts = contentBlock.split('Zeichnung');
            if (parts.length > 1) {
                // Check the part AFTER "Zeichnung"
                const potential = parts[1].trim().split(/[\s,]/)[0]; // First word
                if (potential && potential.match(/[0-9]/) && potential.length > 3) {
                    drawingNumber = potential;
                }
            }
        }

        // Extract Raw Material
        // User Hint: Look for "Artikelbezeichnung". Below that is number and description.
        let rawMaterial = '';

        // Strategy A: Explicit "Artikelbezeichnung" lookup
        const artBezMatch = contentBlock.match(/Artikelbezeichnung[\s\S]*?\n\s*(.+?)(?=\n|$)/i);
        if (artBezMatch && artBezMatch[1]) {
            let line = artBezMatch[1].trim();

            // Aggressive Cleanup using Split
            // 1. Cut at "Zahlung", "Liefer" immediately
            line = line.split(/(?:Zahlung|Liefer|Netto|Betrag)/i)[0];

            // 2. Cut at Quantity pattern (e.g. " 100 Stück")
            // matching: space + digits + optional decimals + space? + Unit
            const qtyMatch = line.match(/(\s+\d+(?:[.,]\d+)?\s*(?:Stk|Stück|m|kg|x|Liter))/i);
            if (qtyMatch) {
                line = line.split(qtyMatch[0])[0];
            }

            // Clean up "Material:" prefix if it exists inside the line
            line = line.replace(/^(?:Material|Werkstoff|Rohmaterial)[:\.]?\s*/i, '');

            // Clean up "Menge" prefix (User specific request)
            line = line.replace(/^Menge\s*/i, '');

            if (line.trim().length > 3) {
                rawMaterial = line.trim();
            }
        }

        // Strategy B: Fallback to "Beistellungen/Material" header if A failed
        if (!rawMaterial) {
            const rawMatMatch = contentBlock.match(/(?:Beistellungen|Material|Werkstoff|Rohmaterial)\s*[:.]?\s*([\s\S]*?)(?=\n\s*(?:Liefertermin|Stück|ID|Zeichnung|$))/i);
            if (rawMatMatch) {
                let potentialRaw = rawMatMatch[1].trim();
                // If it contains "Artikelbezeichnung" and wasn't caught above, parsing logic applies
                if (potentialRaw.includes('Artikelbezeichnung')) {
                    const parts = potentialRaw.split('Artikelbezeichnung');
                    if (parts[1]) {
                        const lines = parts[1].trim().split('\n');
                        if (lines[0]) potentialRaw = lines[0];
                    }
                } else {
                    // Take first non-empty line
                    const lines = potentialRaw.split('\n').filter(l => l.trim().length > 0);
                    if (lines.length > 0) potentialRaw = lines[0].trim();
                }

                if (potentialRaw.length > 2) rawMaterial = potentialRaw;
            }
        }
        // Cleanup Raw Material
        rawMaterial = rawMaterial.replace(/\s+/g, ' ').trim();

        positions.push({
            temp_id: Math.random().toString(36).substr(2, 9),
            id: `${globalOrderId}-${posNr}`,
            quantity: quantity,
            description: desc,
            article_id: articleId,
            value: value.toFixed(2),
            delivery_date: deliveryDate || globalDate,
            drawing_number: drawingNumber,
            raw_material: rawMaterial
        });
    }

    if (positions.length === 0) {
        return parsePositionsFromTextGeneric(text);
    }

    // 4. Company Parsing (Heuristic)
    let company = '';

    // Check for explicit "Hübner"
    if (text.match(/JOHANNES\s+HÜBNER/i)) {
        company = 'Johannes Hübner'; // Shortened as requested
    } else {
        const lines = text.split('\n');
        for (const line of lines) {
            const clean = line.trim();
            if (!clean) continue;
            if (clean.includes('Bestellung')) break;

            // Skip "Schilling & Enns" (User)
            if (clean.includes('Seite') || clean.includes('Schilling & Enns')) continue;

            if (clean.length > 3 && clean.length < 50 && !clean.match(/Datum|Bearbeiter|Telefon|Fax|Email/i)) {
                company = clean;
                break;
            }
        }
    }

    // 5. Contact Person Parsing
    const contactMatch = text.match(/(?:kfm\.|kaufm\.|techn\.)?\s*Sachbearbeitung\s+(.+?)(\n|Telefon|Unsere|Email|$)/i);
    let contactPerson = contactMatch ? contactMatch[1].trim() : '';
    // Cleanup extra artifacts if regex was too greedy
    contactPerson = contactPerson.replace(/\s*Unsere.*$/i, '').replace(/\s*Telefon.*$/i, '').trim();

    return {
        globalOrderId,
        globalDate,
        company,
        contact_person: contactPerson,
        positions
    };
};

const parsePositionsFromTextGeneric = (text) => {
    const positions = [];
    const lines = text.split('\n');
    const orderIdMatch = text.match(/Auftrag(?:dX|s-Nr\.?)?[:\s]*([A-Z0-9-]+)/i);
    const globalOrderId = orderIdMatch ? orderIdMatch[1] : '';

    for (const line of lines) {
        if (!line || line.length < 5) continue;
        const cleanLine = line.replace(/\s+/g, ' ').trim();
        const match = cleanLine.match(/(\d+)\s*(?:Stk|x)\s+(.+?)\s+(\d+[.,]\d{2})/i);
        if (match) {
            positions.push({
                temp_id: Math.random().toString(36).substr(2, 9),
                id: '',
                quantity: match[1],
                description: match[2],
                value: match[3].replace(',', '.'),
                delivery_date: ''
            });
        }
    }
    return { globalOrderId, positions };
};
