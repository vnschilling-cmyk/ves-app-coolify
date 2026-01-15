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

        positions.push({
            temp_id: Math.random().toString(36).substr(2, 9),
            id: `${globalOrderId}-${posNr}`,
            quantity: quantity,
            description: desc,
            article_id: articleId,
            value: value.toFixed(2),
            delivery_date: deliveryDate || globalDate
        });
    }

    if (positions.length === 0) {
        return parsePositionsFromTextGeneric(text);
    }

    // 4. Company Parsing (Heuristic)
    let company = '';

    // Check for explicit "Hübner"
    if (text.match(/JOHANNES\s+HÜBNER/i)) {
        company = 'Johannes Hübner Giessen';
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
