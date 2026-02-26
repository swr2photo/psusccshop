'use client';

import { useState } from 'react';

export default function PasskeyTest() {
  const [log, setLog] = useState<string[]>([]);
  const addLog = (msg: string) => setLog(prev => [...prev, `${new Date().toISOString()}: ${msg}`]);

  const testLogin = async () => {
    addLog('Starting testLogin...');
    try {
      addLog('Fetching options from /api/auth/passkey/login...');
      const optRes = await fetch('/api/auth/passkey/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login-options' }),
      });
      const optData = await optRes.json();
      if (!optRes.ok) {
        addLog(`Error fetching options: ${JSON.stringify(optData)}`);
        return;
      }
      addLog(`Options received: ${JSON.stringify(optData, null, 2)}`);

      addLog('Importing @simplewebauthn/browser...');
      const { startAuthentication } = await import('@simplewebauthn/browser');
      
      addLog('Starting browser authentication. PLEASE INTERACT WITH VIRTUAL AUTHENTICATOR...');
      let assertion;
      try {
        assertion = await startAuthentication({ optionsJSON: optData.options });
        addLog(`Assertion success: ${JSON.stringify(assertion, null, 2)}`);
      } catch (authErr: any) {
        addLog(`Browser Auth Error: ${authErr.name} - ${authErr.message}`);
        console.error('Browser Auth Error:', authErr);
        return;
      }

      addLog('Verifying with server...');
      const verifyRes = await fetch('/api/auth/passkey/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login-verify', challengeId: optData.challengeId, assertion }),
      });
      const verifyData = await verifyRes.json();
      addLog(`Verify Response: HTTP ${verifyRes.status} - ${JSON.stringify(verifyData, null, 2)}`);

    } catch (err: any) {
      addLog(`Unexpected Error: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto', fontFamily: 'monospace' }}>
      <h1>Passkey Diagnostic Test</h1>
      <button 
        onClick={testLogin}
        style={{ padding: '10px 20px', background: '#0071e3', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: 20 }}
      >
        Run Login Test
      </button>
      <div style={{ background: '#111', color: '#0f0', padding: 10, borderRadius: 8, whiteSpace: 'pre-wrap', minHeight: 400 }}>
        {log.join('\n\n')}
      </div>
    </div>
  );
}
