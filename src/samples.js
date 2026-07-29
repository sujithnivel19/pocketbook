/**
 * Sample documents, so the filled state can be seen without a real scan.
 *
 * Each one draws itself onto a canvas first: the answer card's image preview and
 * the list thumbnails are otherwise undemonstrable on an empty vault. The
 * numbers are invented — the Aadhaar values are checksum-valid so the extractor
 * treats them as real, but they belong to nobody.
 */

import { addDoc } from './db.js';
import { fromCanvas } from './images.js';

export const SAMPLES = [
  {
    name: 'Aadhaar — front',
    type: 'ID',
    fields: [
      { label: 'Name', value: 'Sujith P' },
      { label: 'Aadhaar Number', value: '2338 6035 8377' },
      { label: 'Date', value: '14/03/1996' },
      { label: 'Gender', value: 'Male' },
    ],
    text: 'GOVERNMENT OF INDIA\nName: Sujith P\nDOB: 14/03/1996\nMale\n2338 6035 8377',
  },
  {
    name: 'PAN card',
    type: 'ID',
    fields: [
      { label: 'PAN Number', value: 'BQRPS4821K' },
      { label: 'Name', value: 'Sujith P' },
      { label: 'Date', value: '14/03/1996' },
    ],
    text: 'INCOME TAX DEPARTMENT\nPermanent Account Number\nBQRPS4821K\nName: Sujith P',
  },
  {
    name: 'Electricity bill — June',
    type: 'Bill',
    fields: [
      { label: 'Amount', value: '₹1,842.00' },
      { label: 'Date', value: '28/06/2026' },
      { label: 'Account Number', value: 'BLR-4471902' },
    ],
    text: 'BESCOM\nAccount No: BLR-4471902\nDue Date: 28/06/2026\nAmount Payable: ₹1,842.00',
  },
  {
    name: 'Degree certificate',
    type: 'Certificate',
    fields: [
      { label: 'Name', value: 'Sujith P' },
      { label: 'Degree', value: 'B.E. Computer Science' },
      { label: 'Date', value: '22/07/2018' },
    ],
    text: 'Anna University\nThis is to certify that\nName: Sujith P\nDegree: B.E. Computer Science\nConferred: 22/07/2018',
  },
];

function renderCard(sample) {
  const canvas = document.createElement('canvas');
  canvas.width = 880;
  canvas.height = 550;
  const g = canvas.getContext('2d');

  g.fillStyle = '#F4F3EE';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#E4E1D8';
  g.fillRect(0, 0, canvas.width, 84);

  g.fillStyle = '#2A2A26';
  g.font = '600 30px Instrument Sans, sans-serif';
  g.fillText(sample.name.toUpperCase(), 40, 54);

  g.font = '400 17px DM Mono, monospace';
  g.fillStyle = '#6B6A63';
  g.fillText(sample.type, 40, 132);

  let y = 196;
  for (const field of sample.fields) {
    g.fillStyle = '#8A887F';
    g.font = '400 16px Instrument Sans, sans-serif';
    g.fillText(field.label.toUpperCase(), 40, y);
    g.fillStyle = '#1E1E1B';
    g.font = '500 30px DM Mono, monospace';
    g.fillText(field.value, 40, y + 38);
    y += 90;
  }

  g.strokeStyle = '#CFCCC2';
  g.lineWidth = 2;
  g.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  return canvas;
}

export async function seed() {
  const base = Date.now() - 86_400_000 * 9;
  for (let i = 0; i < SAMPLES.length; i += 1) {
    const { fileBlob, thumbBlob } = await fromCanvas(renderCard(SAMPLES[i]));
    await addDoc({
      ...SAMPLES[i],
      fileBlob,
      thumbBlob,
      source: 'sample',
      createdAt: base + i * 86_400_000 * 2,
    });
  }
}
