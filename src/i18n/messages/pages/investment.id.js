export default {
  meta: {
    title: 'Kalkulator Investasi FC Mobile | Kalkulator Profit & ROI | FCMOBILETOOLS',
    description: 'Hitung profit investasi FC Mobile, pajak pasar, harga jual titik impas, ROI, dan harga jual target dari harga beli, jumlah, dan harga jual yang Anda harapkan.'
  },
  hero: {
    kicker: 'FC MOBILE / LAB PASAR', badge: 'KALKULATOR LIVE',
    h1a: 'Ketahui ', h1em: 'keuntungan sebenarnya', h1b: 'sebelum berinvestasi',
    lede: 'Simulasikan investasi kartu pemain lengkap dengan pajak penjualan. Lihat koin bersih, profit, ROI, dan harga jual pas untuk balik modal.',
    pointTaxB: '10%', pointTax: 'pajak pasar default', pointNetB: 'BERSIH', pointNet: 'hasil setelah pajak', pointLiveB: 'LIVE', pointLive: 'hitung ulang instan',
    metricAria: 'Pratinjau kalkulator investasi', netReturn: 'HASIL BERSIH', breakEven: 'TITIK IMPAS'
  },
  calc: {
    eyebrow: '01 / ANALISIS INVESTASI', title: 'Jalankan transaksinya',
    lead: 'Masukkan angka pasar yang benar-benar Anda pertimbangkan. Semuanya diperbarui saat Anda mengetik.',
    taxChip: 'PAJAK PASAR',
    buy: 'HARGA BELI', sell: 'HARGA JUAL', perCard: 'PER KARTU', qty: 'JUMLAH', cards: 'KARTU', tax: 'PAJAK PASAR', percent: 'PERSEN',
    targetQ: 'INGIN TARGET PROFIT?', targetHelp: 'Gunakan angka biasa atau singkatan seperti 750K, 12.5M, atau 1.25B.', coins: 'koin'
  },
  result: {
    label: 'PERKIRAAN PROFIT', afterTax: 'setelah pajak pasar {rate}', pill: 'UNTUNG',
    totalCost: 'TOTAL BIAYA', netSale: 'PENJUALAN BERSIH', taxPaid: 'PAJAK DIBAYAR', roi: 'ROI',
    formula: 'RUMUS: PENJUALAN BERSIH − TOTAL BIAYA = PROFIT', reset: 'ATUR ULANG PERHITUNGAN ↺'
  },
  insight: {
    breakEven: 'TITIK IMPAS', breakEvenText: 'Harga jual minimum per kartu untuk mengembalikan harga beli setelah pajak pasar yang dipilih.', breakEvenMove: 'KENAIKAN HARGA YANG DIPERLUKAN',
    target: 'HARGA JUAL TARGET', targetText: 'Harga jual per kartu yang diperlukan untuk mencapai target profit setelah pajak.', yourTarget: 'TARGET ANDA',
    exposure: 'MODAL BERISIKO', exposureText: 'Total koin yang dikomitmenkan untuk posisi ini sebelum penjualan apa pun.', quantity: 'JUMLAH'
  },
  explain: {
    eyebrow: '02 / MEMAHAMI TRANSAKSI', h2a: 'Profit bukanlah', h2em: 'harga pajangan',
    text: 'Pajak pasar dipotong dari hasil penjualan. Kalkulator ini bekerja dari uang yang benar-benar Anda terima, bukan harga pasar yang tertera.',
    flow: [
      { s: 'BELI', d: 'Total biaya perolehan Anda' },
      { s: 'JUAL', d: 'Nilai penjualan kotor di pasar' },
      { s: 'SETELAH PAJAK', d: 'Koin yang kembali kepada Anda' },
      { s: 'HASIL', d: 'Profit sebenarnya dari posisi ini' }
    ]
  },
  reference: {
    eyebrow: '03 / REFERENSI CEPAT', title: 'Matematika pasar yang berguna', lead: 'Ingat hubungan ini saat memeriksa investasi kartu.',
    items: [
      { b: 'Pengali titik impas', d: 'Dengan pajak 10%, harga jual harus 11.1% di atas harga beli agar balik modal.' },
      { b: 'Margin profit', d: 'Profit dihitung terhadap koin bersih yang diterima dari penjualan.' },
      { b: 'Perubahan harga', d: 'Perubahan dari harga beli ke harga jual kotor yang Anda harapkan.' }
    ]
  },
  faq: {
    eyebrow: '04 / FAQ', title: 'FAQ Kalkulator Investasi FC Mobile',
    items: [
      { q: 'Apakah kalkulator menyertakan pajak pasar?', a: 'Ya. Defaultnya 10%, dan Anda dapat mengubah kolom pajak jika tarif di dalam game berubah. Profit dan ROI dihitung dari penjualan bersih setelah pajak.' },
      { q: 'Apa itu harga jual titik impas?', a: 'Itu adalah harga jual kotor terendah yang mengembalikan seluruh biaya pembelian setelah pajak. Dengan pajak 10%, menjual di harga yang sama dengan harga beli akan menyebabkan kerugian.' },
      { q: 'Bisakah saya menghitung investasi dengan beberapa kartu?', a: 'Bisa. Masukkan jumlah kartu di kolom Jumlah. Total biaya, nilai penjualan, pajak, hasil bersih, dan profit dihitung untuk seluruh posisi.' },
      { q: 'Apakah ini memprediksi kartu akan naik?', a: 'Tidak. Kalkulator ini menghitung hasil keuangan dari harga yang Anda masukkan. Pergerakan pasar, penawaran, permintaan, dan likuiditas tetap menentukan apakah penjualan target benar-benar tercapai.' }
    ]
  },
  ui: {
    roi: '{n}% ROI',
    status: { profit: 'UNTUNG', loss: 'RUGI', even: 'IMPAS' },
    qtyOne: '{n} KARTU', qtyMany: '{n} KARTU'
  }
};
