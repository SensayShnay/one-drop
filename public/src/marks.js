// One Drop — what is drawn on the water, so it can be recorded too.
//
// Every instrument draws itself with HTML elements laid over the canvas, which
// is right for the screen: they stay crisp, they take touches, and the browser
// does the work. But a canvas recording only ever sees the canvas, so a kept
// ripple used to come back as bare water with the instruments missing.
//
// So while a recording is rolling, each thing that draws on the water also
// leaves a note here of where it is and what it looks like, and the recorder
// paints those onto its own canvas over a copy of the water. Nothing is
// collected when nothing is recording, so this costs nothing the rest of the
// time.

export const MARKS = { on: false, list: [] };

export function mark(m) { if (MARKS.on) MARKS.list.push(m); }

const clamp01 = v => Math.max(0, Math.min(1, v || 0));

// a soft round glow, which is most of what this piece is made of
function glow(ctx, x, y, r, rgb, a) {
  if (r <= 0 || a <= 0.004) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.55, `rgba(${rgb},${a * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
}

function line(ctx, pts, width, rgb, a) {
  if (!pts || pts.length < 2) return;
  ctx.strokeStyle = `rgba(${rgb},${a})`;
  ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

export function paintMarks(ctx) {
  for (const m of MARKS.list) {
    const a = clamp01(m.a === undefined ? 1 : m.a);
    if (a < 0.01) continue;
    const lit = clamp01(m.lit);
    switch (m.k) {
      case 'bowl': {                                   // a brass ring, lit as it rings
        glow(ctx, m.x, m.y, m.r * 1.5, '228,178,104', a * (0.05 + lit * 0.3));
        ctx.strokeStyle = `rgba(232,196,136,${a * (0.3 + lit * 0.62)})`;
        ctx.lineWidth = 1 + lit;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.2832); ctx.stroke();
        if (m.note) {
          ctx.fillStyle = `rgba(244,214,164,${a * (0.22 + lit * 0.68)})`;
          ctx.font = `italic 300 ${Math.max(11, Math.min(22, m.r * 0.3))}px "Cormorant Garamond", Georgia, serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(m.note, m.x, m.y);
        }
        break;
      }
      case 'stone':                                    // a dark stone on the bed, ringing
        glow(ctx, m.x, m.y, m.r * 2.6, '150,206,236', a * lit * 0.5);
        ctx.fillStyle = `rgba(28,38,48,${a * 0.92})`;
        ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r, m.r * 0.84, m.rot || 0, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = `rgba(174,206,226,${a * (0.18 + lit * 0.6)})`;
        ctx.lineWidth = 1; ctx.stroke();
        break;
      case 'leaf':                                     // a leaf on the water, plucked by rain
        glow(ctx, m.x, m.y, m.r * 2.2, '186,226,168', a * lit * 0.45);
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot || 0);
        ctx.fillStyle = `rgba(96,126,92,${a * (0.5 + lit * 0.4)})`;
        ctx.beginPath(); ctx.ellipse(0, 0, m.r * (m.aspect || 0.45), m.r, 0, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = `rgba(190,224,180,${a * (0.3 + lit * 0.5)})`;
        ctx.lineWidth = 0.8; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -m.r * 0.85); ctx.lineTo(0, m.r * 0.85); ctx.stroke();
        ctx.restore();
        break;
      case 'rock':                                     // a rock in the creek, the water breaking on it
        glow(ctx, m.x, m.y - m.r * 0.5, m.r * 1.9, '226,244,252', a * (0.05 + lit * 0.5));
        ctx.fillStyle = `rgba(34,39,44,${a})`;
        ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r, m.r * 0.82, 0, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = `rgba(120,132,142,${a * 0.5})`;
        ctx.lineWidth = 1; ctx.stroke();
        break;
      case 'hole':                                     // open water in the ice
        ctx.fillStyle = `rgba(10,22,34,${a * 0.9})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = `rgba(196,228,244,${a * (0.5 + lit * 0.5)})`;
        ctx.lineWidth = 1; ctx.stroke();
        glow(ctx, m.x, m.y, m.r * 2.4, '150,206,236', a * (0.12 + lit * 0.5));
        break;
      case 'pin':                                      // a sound left floating
        glow(ctx, m.x, m.y, m.r * 3.4, '168,214,238', a * (0.2 + lit * 0.6));
        ctx.fillStyle = `rgba(222,240,250,${a * (0.6 + lit * 0.4)})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.2832); ctx.fill();
        break;
      case 'spark':                                    // a drip running a crack
        glow(ctx, m.x, m.y, 10, '226,246,255', a);
        break;
      case 'thing':                                    // something that does not belong
        ctx.fillStyle = `rgba(${m.rgb || '150,150,150'},${a * 0.72})`;
        ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r, m.r * 0.7, m.rot || 0, 0, 6.2832); ctx.fill();
        break;
      case 'crack':                                    // a fracture, dark with a frosted edge
        line(ctx, m.pts, (m.w || 1) + 2.4, '232,246,255', a * 0.35);
        line(ctx, m.pts, m.w || 1, '22,44,62', a * 0.9);
        break;
      case 'crest':                                    // the surge coming down the creek
        line(ctx, m.pts, m.w || 1.4, '220,240,250', a);
        break;
      case 'flake':                                    // a crystal on its way down
      {
        const R = m.r || 10;
        ctx.strokeStyle = `rgba(226,244,255,${a * 0.85})`;
        ctx.lineWidth = Math.max(0.6, R * 0.055);
        ctx.lineCap = 'round';
        for (let k = 0; k < (m.arms || 6); k++) {
          const th = k * Math.PI / 3;
          const dx = Math.cos(th), dy = Math.sin(th);
          ctx.beginPath();
          ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + dx * R, m.y + dy * R);
          // one pair of side branches, enough to read as a crystal at this size
          const bx = m.x + dx * R * 0.55, by = m.y + dy * R * 0.55;
          const px = -dy, py = dx, L = R * 0.26;
          ctx.moveTo(bx, by); ctx.lineTo(bx + (dx * 0.7 + px) * L, by + (dy * 0.7 + py) * L);
          ctx.moveTo(bx, by); ctx.lineTo(bx + (dx * 0.7 - px) * L, by + (dy * 0.7 - py) * L);
          ctx.stroke();
        }
        glow(ctx, m.x, m.y, R * 0.8, '226,244,255', a * 0.22);
        break;
      }
      case 'drop':                                     // the one waiting out in open water
        glow(ctx, m.x, m.y, m.r * 2.6, '188,222,240', a * 0.5);
        ctx.strokeStyle = `rgba(214,236,248,${a * 0.8})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.2832); ctx.stroke();
        break;
    }
  }
}
