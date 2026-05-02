import { ASTManager } from './graph/ASTManager';

async function runTest() {
    console.log('--- Starting ASTManager Test ---');
    
    const astManager = new ASTManager();
    
    const authContent = `
        export function login() {
            console.log('Logging in');
        }
    `;
    
    const userContent = `
        import { login } from './auth';
        
        function handleUser() {
            login();
        }
    `;
    
    const paymentContent = `
        const { login } = require('./auth');
        
        function handlePayment() {
            login();
        }
    `;
    
    console.log('Parsing files...');
    await astManager.parseFile('auth.ts', authContent);
    await astManager.parseFile('user.ts', userContent);
    await astManager.parseFile('payment.js', paymentContent);
    
    console.log('\n--- Running Impact Analysis ---');
    console.log('If we change auth.ts, what files are affected?');
    
    const impact = await astManager.analyzeImpact('auth.ts');
    console.log('Impacted files:', impact);
    
    if (impact.includes('user.ts') && impact.includes('payment.js')) {
        console.log('✅ TEST PASSED: Impact analysis correctly identified dependents.');
    } else {
        console.error('❌ TEST FAILED: Missing dependents in impact analysis.');
    }
}

runTest().catch(console.error);
