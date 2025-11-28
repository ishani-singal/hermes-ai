import { translateText } from './translation-service';

async function runTests() {
    console.log('Starting translation tests...');

    const testCases = [
        {
            text: 'Puede darme de tales para equipo.',
            from: 'es-ES',
            to: 'en-US',
            desc: 'User reported case'
        },
        {
            text: 'Necesito ayuda con el Compressor 3000.',
            from: 'es-ES',
            to: 'en-US',
            desc: 'Proper noun: Compressor 3000'
        },
        {
            text: 'Checkear el status del HVAC system.',
            from: 'es-ES',
            to: 'en-US',
            desc: 'Hinglish/Spanglish with technical terms'
        },
        {
            text: 'La bomba de agua Grundfos no funciona.',
            from: 'es-ES',
            to: 'en-US',
            desc: 'Brand name: Grundfos'
        }
    ];

    for (const test of testCases) {
        console.log(`\n--- Test: ${test.desc} ---`);
        console.log(`Input: "${test.text}"`);
        try {
            const start = Date.now();
            const result = await translateText(test.text, test.from, test.to);
            const duration = Date.now() - start;
            console.log(`Output: "${result}"`);
            console.log(`Duration: ${duration}ms`);
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

runTests().catch(console.error);
