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

        const qtyMatch = contentBlock.match(/(\d+)\s+Stück/i);
        const quantity = qtyMatch ? qtyMatch[1] : '1';

        const deliveryMatch = contentBlock.match(/Liefertermin.*?bis:\s*(\d{2}\.\d{2}\.\d{4})/i);
        const deliveryDate = deliveryMatch ? deliveryMatch[1].split('.').reverse().join('-') : '';

        // Remove dates from price search
        const contentWithoutDates = contentBlock.replace(/\d{2}\.\d{2}\.\d{4}/g, '');

        // Broad Regex for Price: Matches 1.234,56 | 42,00 | 2,10
        // MUST have a comma to distinguish from IDs (e.g. 114145.1) and Dates.
        // Matches: 1.234,56 | 1 234,56 | 1234,56 | 42,00
        const prices = contentWithoutDates.match(/(\d{1,5}(?:[.\s]\d{3})*,\s*\d{1,2})(?!\d)/g);

        let value = '0';
        if (prices && prices.length > 0) {
            const parsePrice = (str) => {
                let clean = str.replace(/\s/g, '');
                if (clean.includes(',') && clean.includes('.')) {
                    // 1.234,56 -> 1234.56
                    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
                } else if (clean.includes(',')) {
                    // 1234,56 -> 1234.56
                    return parseFloat(clean.replace(',', '.'));
                } else {
                    // 1234.56 -> 1234.56
                    return parseFloat(clean);
                }
            };

            // LOGIC: Take the LAST found price in the block.
            // This usually corresponds to the "Gesamtpreis" column.
            const lastPrice = parsePrice(prices[prices.length - 1]);
            value = lastPrice.toFixed(2);
        }

        let desc = contentBlock
            .replace(/(\d+)\s+Stück/i, '')
            .replace(/Liefertermin.*?bis:\s*\d{2}\.\d{2}\.\d{4}/i, '')
            .replace(/(\d{1,5}(?:[.\s]\d{3})*,\s*\d{1,2})(?!\d)/g, '') // Remove prices
            .replace(/\s+/g, ' ')
            .trim();

        if (desc.length > 50) desc = desc.substring(0, 50) + '...';

        positions.push({
            temp_id: Math.random().toString(36).substr(2, 9),
            id: `${globalOrderId}-${posNr}`,
            quantity: quantity,
            description: `${articleId} ${desc}`,
            value: value,
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

    return {
        globalOrderId,
        globalDate,
        company,
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
