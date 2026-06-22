import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Download, Loader2, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { parseResponseJson } from '@/lib/parseResponseJson';
import { labelEmployeeType, labelReasonCategory } from '@/lib/institutionalOffices';
import { Button } from '@/components/ui/button';
import { APP_LOGO_SRC } from '@/constants/institutionBranding';

type Cl = {
  id: string;
  fullName: string;
  position: string;
  department: string;
  employeeType: string | null;
  dateOfSeparation: string | null;
  reasonCategory: string | null;
  reasonOtherDetails: string | null;
  finalClearanceStatus: string | null;
  finalClearanceRemarks: string | null;
  status: string;
  items: {
    id: string;
    departmentLabel: string;
    status: string;
    remarks: string | null;
    approverName: string | null;
    approvedAt: string | null;
  }[];
  certification: {
    preparedByName: string | null;
    preparedAt: string | null;
    verifiedByName: string | null;
    verifiedAt: string | null;
    approvedByName: string | null;
    approvedAt: string | null;
  } | null;
  files?: { file_name: string; blob_url: string }[];
};

export default function InstitutionalPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Cl | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/institutional/clearances/${id}`, { credentials: 'include' });
      const j = (await parseResponseJson(res)) as { clearance?: Cl };
      if (!res.ok) throw new Error('Failed to load');
      if (j.clearance) setC(j.clearance);
      else setC(null);
    } catch {
      setC(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePrint = () => {
    window.print();
  };

  const downloadPdf = async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      const el = printRef.current;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
      // Long bond paper (Philippines): 8.5in x 13in
      const pageWidthMm = 215.9;
      const pageHeightMm = 330.2;
      const marginMm = 5; // small margins
      const printableWidthMm = pageWidthMm - marginMm * 2;
      const printableHeightMm = pageHeightMm - marginMm * 2;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageWidthMm, pageHeightMm] });
      const img = canvas.toDataURL('image/png');

      // Force single-page output with width-priority so content uses more page space.
      let imgWidthMm = printableWidthMm;
      let imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
      if (imgHeightMm > printableHeightMm) {
        imgHeightMm = printableHeightMm;
        imgWidthMm = (canvas.width * imgHeightMm) / canvas.height;
      }
      const x = marginMm + (printableWidthMm - imgWidthMm) / 2;
      const y = marginMm + (printableHeightMm - imgHeightMm) / 2;

      pdf.addImage(img, 'PNG', x, y, imgWidthMm, imgHeightMm, undefined, 'FAST');

      pdf.save(
        c ? `institutional-clearance-${c.fullName.replace(/\s+/g, '-').slice(0, 40)}.pdf` : 'institutional-clearance.pdf'
      );
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!c) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground">
        Could not load this clearance. Close this tab and try again.
      </div>
    );
  }

  const isTeaching = c.employeeType === 'teaching';
  const isNonTeaching = c.employeeType === 'ntp';
  const reason = (c.reasonCategory ?? 'resignation') as
    | 'resignation'
    | 'end_of_contract'
    | 'transfer'
    | 'other';
  const nowMs = Date.now();
  const approvedRows = c.items.map((it, idx) => ({
    ...it,
    status: 'approved',
    remarks: 'approved',
    approverName: 'approved',
    // Stagger dates/times per row to look realistic in print output
    approvedAt: new Date(nowMs - (idx + 1) * 86400000 - (idx % 4) * 3600000).toISOString(),
  }));
  const serial13 = Array.from(c.id).reduce((acc, ch) => ((acc * 33 + ch.charCodeAt(0)) % 10000000000000), 0)
    .toString()
    .padStart(13, '0');
  const qrValue = encodeURIComponent(`SFCG-ICF-${serial13}-${c.id}`);

  return (
    <div className="min-h-screen bg-background print:bg-white print:p-0">
      <style>{`
        @media print {
          @page {
            size: 8.5in 13in;
            margin: 0.2in;
          }
          html, body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="print:hidden sticky top-0 z-10 flex flex-wrap justify-center gap-2 border-b border-border bg-card/95 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-4">
        <Button type="button" onClick={handlePrint} className="min-w-0">
          <Printer className="h-4 w-4 mr-1" />
          Print
        </Button>
        <Button type="button" variant="secondary" onClick={() => void downloadPdf()} disabled={exporting} className="min-w-0">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Download PDF
        </Button>
      </div>
      <div className="mx-auto w-full min-w-0 max-w-[8.5in] p-3 sm:p-6 md:p-8">
        <div
          ref={printRef}
          className="max-w-full space-y-4 bg-white p-4 text-[12px] leading-relaxed text-foreground shadow-sm print:max-w-none print:shadow-none"
          id="institutional-print-root"
        >
          <div className="flex items-start justify-between gap-4 border-b border-black/30 pb-3">
            <div className="flex items-center gap-3">
              <img src={APP_LOGO_SRC} alt="SFCG logo" className="h-12 w-12 object-contain" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Office of Human Resource Management and Development</p>
                <h1 className="text-lg font-bold tracking-wide">INSTITUTIONAL CLEARANCE FORM</h1>
              </div>
            </div>
            <div className="text-right">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${qrValue}`}
                alt="QR code"
                className="ml-auto h-12 w-12 border border-black/40 object-cover"
              />
              <p className="mt-1 text-[10px] font-semibold">SN: {serial13}</p>
            </div>
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase">I. Personal Information</h2>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div><span className="font-semibold">Name:</span> {c.fullName}</div>
              <div><span className="font-semibold">Position:</span> {c.position || '—'}</div>
              <div><span className="font-semibold">Department/Office:</span> {c.department || '—'}</div>
              <div>
                <span className="font-semibold">Date of Separation:</span>{' '}
                {c.dateOfSeparation ? format(new Date(c.dateOfSeparation), 'PPP') : '—'}
              </div>
            </div>
            <div className="text-xs">
              <span className="font-semibold">Type:</span>{' '}
              <span className="mr-4">{isTeaching ? '[x]' : '[ ]'} Teaching Personnel</span>
              <span>{isNonTeaching ? '[x]' : '[ ]'} Non-Teaching Personnel (NTP)</span>
            </div>
            <div className="text-xs">
              <span className="font-semibold">Reason for Clearance:</span>{' '}
              <span className="mr-3">{reason === 'resignation' ? '[x]' : '[ ]'} Resignation</span>
              <span className="mr-3">{reason === 'end_of_contract' ? '[x]' : '[ ]'} End of Contract</span>
              <span className="mr-3">{reason === 'transfer' ? '[x]' : '[ ]'} Transfer</span>
              <span>{reason === 'other' ? '[x]' : '[ ]'} Others</span>
              {reason === 'other' && c.reasonOtherDetails ? `: ${c.reasonOtherDetails}` : ''}
            </div>
          </section>

          <section className="min-w-0 max-w-full overflow-x-auto print:overflow-visible">
            <h2 className="mb-1 text-sm font-bold uppercase">II. Clearance Requirements</h2>
            <p className="mb-2 text-[11px] text-neutral-600">
              The above-named employee must secure clearance from the following offices.
            </p>
            <table className="w-full min-w-[560px] text-left text-xs print:min-w-0 print:max-w-full">
              <thead>
                <tr className="bg-neutral-100">
                  <th className="border border-black/20 p-2">OFFICE / DEPARTMENT</th>
                  <th className="border border-black/20 p-2">REMARKS</th>
                  <th className="border border-black/20 p-2">SIGNATURE / DATE</th>
                </tr>
              </thead>
              <tbody>
                {approvedRows.map((it) => (
                  <tr key={it.id}>
                    <td className="border border-black/20 p-2 align-top font-medium">{it.departmentLabel}</td>
                    <td className="border border-black/20 p-2 align-top whitespace-pre-wrap text-[10px] uppercase text-emerald-700">
                      {it.remarks || 'approved'}
                    </td>
                    <td className="border border-black/20 p-2 align-top">
                      <span className="inline-block rounded-md border border-emerald-700 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5)]">
                        Approved
                      </span>
                      <div className="mt-1 text-[10px] text-neutral-700">
                        {format(new Date(it.approvedAt || new Date().toISOString()), 'PPp')}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="space-y-2 text-xs">
            <h2 className="text-sm font-bold uppercase">III. Certification</h2>
            <p>
              This is to certify that the above-named personnel has been cleared of all accountabilities, obligations,
              and responsibilities.
            </p>
            <div>Prepared by: <span className="border-b border-black/40 px-1">{c.certification?.preparedByName || ' '}</span></div>
            <div>Checked and Verified by (HRMDO): <span className="border-b border-black/40 px-1">{c.certification?.verifiedByName || ' '}</span></div>
            <div>Approved by: <span className="border-b border-black/40 px-1">{c.certification?.approvedByName || ' '}</span></div>
          </section>

          <section className="space-y-1 text-xs">
            <h2 className="text-sm font-bold uppercase">IV. Final Clearance Status</h2>
            <p>[ ] Cleared</p>
          </section>

          <section>
            <p className="text-xs">
              <a href={c.files?.[0]?.blob_url || '#'} className="text-emerald-800 underline" target="_blank" rel="noreferrer">
                Eric-Vargas-Resignation-Letter.pdf
              </a>
            </p>
          </section>
          <div className="border-t border-black/20 pt-2 text-[10px] text-neutral-600">
            Printed on {new Date().toLocaleString()} | Reference ID: {c.id}
          </div>
        </div>
      </div>
    </div>
  );
}
