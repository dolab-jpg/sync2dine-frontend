/**
 * One-off Soho66 SIP smoke: REGISTER on UDP :8060 then INVITE a UK mobile.
 * No real RTP/Aria media — proves credentials + registrar only.
 */
const sip = require('sip');
const digest = require('sip/digest');
const os = require('os');
const dns = require('dns').promises;

const USER = process.env.SOHO66_SIP_USERNAME;
const PASS = process.env.SOHO66_SIP_PASSWORD;
const DOMAIN = process.env.SOHO66_SIP_DOMAIN || 'sip.soho66.co.uk';
const REG_PORT = Number(process.env.SOHO66_SIP_PORT || 8060);
const LOCAL_PORT = Number(process.env.SOHO66_LOCAL_PORT || 50660);
const DIAL_RAW = process.env.SMOKE_DIAL || '07576442345';
const DIAL = DIAL_RAW.replace(/\D/g, '').replace(/^0/, '44');

if (!USER || !PASS) {
  console.error('Set SOHO66_SIP_USERNAME and SOHO66_SIP_PASSWORD');
  process.exit(4);
}

function localIp() {
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const i of ifs[name] || []) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return '127.0.0.1';
}

function rstring() {
  return Math.floor(Math.random() * 1e9).toString();
}

(async () => {
  let regHost;
  try {
    const addrs = await dns.resolve4(DOMAIN);
    regHost = addrs[0];
    console.log('RESOLVED', DOMAIN, '->', regHost);
  } catch (e) {
    console.log('DNS_FAIL', e.message);
    process.exit(3);
  }

  const ip = localIp();
  console.log('LOCAL_IP', ip, 'LOCAL_PORT', LOCAL_PORT, 'DIAL', DIAL);

  sip.start(
    { port: LOCAL_PORT, udp: true, tcp: false, address: '0.0.0.0', publicAddress: ip },
    (rq) => {
      console.log('INCOMING', rq.method, rq.uri);
      sip.send(sip.makeResponse(rq, 200, 'Ok'));
    },
  );

  const aor = `sip:${USER}@${DOMAIN}`;
  const contactUri = `sip:${USER}@${ip}:${LOCAL_PORT}`;
  const callId = `${rstring()}@${ip}`;
  let cseq = 1;
  const fromTag = rstring();
  const creds = { user: USER, password: PASS };

  function cleanup(code) {
    setTimeout(() => {
      try {
        sip.stop();
      } catch {
        /* ignore */
      }
      process.exit(code);
    }, 400);
  }

  setTimeout(() => {
    console.log('RESULT=timeout');
    cleanup(2);
  }, 40000);

  function placeCall() {
    const target = `sip:${DIAL}@${DOMAIN}:${REG_PORT}`;
    console.log('SEND_INVITE', target);
    const inviteCallId = `${rstring()}@${ip}`;
    const fromTag2 = rstring();
    let inviteCseq = 1;
    let inviteAuth = {};

    const sdp =
      'v=0\r\n' +
      `o=- ${rstring()} ${rstring()} IN IP4 ${ip}\r\n` +
      's=TradePro Smoke\r\n' +
      `c=IN IP4 ${ip}\r\n` +
      't=0 0\r\n' +
      'm=audio 40000 RTP/AVP 0 8 101\r\n' +
      'a=rtpmap:0 PCMU/8000\r\n' +
      'a=rtpmap:8 PCMA/8000\r\n' +
      'a=rtpmap:101 telephone-event/8000\r\n' +
      'a=fmtp:101 0-15\r\n' +
      'a=sendrecv\r\n';

    function handleInviteRs(rs) {
      if (rs.status >= 100 && rs.status < 200) {
        console.log('CALL_PROGRESS', rs.status, rs.reason);
        return;
      }
      if (rs.status >= 200 && rs.status < 300) {
        console.log('RESULT=answered');
        try {
          sip.send({
            method: 'ACK',
            uri: (rs.headers.contact && rs.headers.contact[0] && rs.headers.contact[0].uri) || target,
            headers: {
              to: rs.headers.to,
              from: rs.headers.from,
              'call-id': rs.headers['call-id'],
              cseq: { method: 'ACK', seq: rs.headers.cseq.seq },
              via: [],
            },
          });
        } catch (e) {
          console.log('ACK_ERR', e.message);
        }
        setTimeout(() => {
          try {
            sip.send(
              {
                method: 'BYE',
                uri: (rs.headers.contact && rs.headers.contact[0] && rs.headers.contact[0].uri) || target,
                headers: {
                  to: rs.headers.to,
                  from: rs.headers.from,
                  'call-id': rs.headers['call-id'],
                  cseq: { method: 'BYE', seq: rs.headers.cseq.seq + 1 },
                  via: [],
                },
              },
              () => {},
            );
          } catch {
            /* ignore */
          }
          console.log('NOTE=hung_up_no_aria_media_path');
          cleanup(0);
        }, 8000);
        return;
      }
      console.log('RESULT=invite_failed', rs.status, rs.reason);
      cleanup(1);
    }

    function sendInvite(challengeRs) {
      const rq = {
        method: 'INVITE',
        uri: target,
        headers: {
          to: { uri: `sip:${DIAL}@${DOMAIN}` },
          from: { name: 'INMconstruction', uri: aor, params: { tag: fromTag2 } },
          'call-id': inviteCallId,
          cseq: { method: 'INVITE', seq: inviteCseq++ },
          contact: [{ uri: contactUri }],
          'content-type': 'application/sdp',
          'max-forwards': 70,
          'user-agent': 'TradePro-Smoke/1.0',
          via: [],
          allow: 'INVITE, ACK, CANCEL, BYE, OPTIONS',
        },
        content: sdp,
      };
      if (challengeRs) digest.signRequest(inviteAuth, rq, challengeRs, creds);
      sip.send(rq, (rs) => {
        console.log('INVITE_STATUS', rs.status, rs.reason);
        if (rs.status === 401 || rs.status === 407) {
          inviteAuth = {};
          const rq2 = {
            method: 'INVITE',
            uri: target,
            headers: {
              to: { uri: `sip:${DIAL}@${DOMAIN}` },
              from: { name: 'INMconstruction', uri: aor, params: { tag: fromTag2 } },
              'call-id': inviteCallId,
              cseq: { method: 'INVITE', seq: inviteCseq++ },
              contact: [{ uri: contactUri }],
              'content-type': 'application/sdp',
              'max-forwards': 70,
              'user-agent': 'TradePro-Smoke/1.0',
              via: [],
              allow: 'INVITE, ACK, CANCEL, BYE, OPTIONS',
            },
            content: sdp,
          };
          digest.signRequest(inviteAuth, rq2, rs, creds);
          console.log('SEND_INVITE_AUTH');
          sip.send(rq2, handleInviteRs);
        } else {
          handleInviteRs(rs);
        }
      });
    }

    sendInvite();
  }

  function sendRegister() {
    const rq = {
      method: 'REGISTER',
      uri: `sip:${DOMAIN}:${REG_PORT}`,
      headers: {
        to: { uri: aor },
        from: { uri: aor, params: { tag: fromTag } },
        'call-id': callId,
        cseq: { method: 'REGISTER', seq: cseq++ },
        contact: [{ uri: contactUri, params: { expires: 300 } }],
        expires: 300,
        'max-forwards': 70,
        'user-agent': 'TradePro-Smoke/1.0',
        via: [],
      },
    };

    console.log('SEND_REGISTER initial ->', rq.uri);
    sip.send(rq, (rs) => {
      console.log('REGISTER_STATUS', rs.status, rs.reason);
      if (rs.status === 401 || rs.status === 407) {
        const authCtx = {};
        const rq2 = {
          method: 'REGISTER',
          uri: `sip:${DOMAIN}:${REG_PORT}`,
          headers: {
            to: { uri: aor },
            from: { uri: aor, params: { tag: fromTag } },
            'call-id': callId,
            cseq: { method: 'REGISTER', seq: cseq++ },
            contact: [{ uri: contactUri, params: { expires: 300 } }],
            expires: 300,
            'max-forwards': 70,
            'user-agent': 'TradePro-Smoke/1.0',
            via: [],
          },
        };
        digest.signRequest(authCtx, rq2, rs, creds);
        console.log('SEND_REGISTER_AUTH');
        sip.send(rq2, (rs2) => {
          console.log('REGISTER_AUTH_STATUS', rs2.status, rs2.reason);
          if (rs2.status >= 200 && rs2.status < 300) {
            console.log('RESULT=registered');
            placeCall();
          } else {
            console.log('RESULT=register_failed', rs2.status);
            cleanup(1);
          }
        });
      } else if (rs.status >= 200 && rs.status < 300) {
        console.log('RESULT=registered_no_challenge');
        placeCall();
      } else {
        console.log('RESULT=register_failed', rs.status);
        cleanup(1);
      }
    });
  }

  sendRegister();
})();
