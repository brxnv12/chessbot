// Mat qidiruvchi. Chess klassi tashqaridan beriladi (brauzer va Node uchun bir xil kod).
export function makeSolver(Chess) {
  const clone = (g) => new Chess(g.fen());
  // Yurayotgan tomon n yurishda mat qila oladimi?
  function canMate(g, n) {
    for (const m of g.moves()) {
      const t = clone(g); t.move(m);
      if (t.isCheckmate()) return true;
      if (n > 1 && !t.isGameOver() && forced(t, n - 1)) return true;
    }
    return false;
  }
  // Himoyachi yuradi: har qanday javobdan keyin hujumchi n yurishda mat qiladimi?
  function forced(g, n) {
    const replies = g.moves();
    if (!replies.length) return false;
    return replies.every((r) => { const t = clone(g); t.move(r); return canMate(t, n); });
  }
  // Hujumchi mat qiladigan eng kichik yurish soni (max gacha), topilmasa 0
  function depth(g, max = 3) { for (let n = 1; n <= max; n++) if (canMate(g, n)) return n; return 0; }
  // Raqibning eng "qarshilik qiladigan" javobi
  function defend(g, n) {
    const t0 = g.moves().map((r) => { const t = clone(g); t.move(r); return { r, t }; });
    return (t0.find((x) => !canMate(x.t, n - 1)) || t0[0]).r;
  }
  return { canMate, forced, depth, defend };
}
