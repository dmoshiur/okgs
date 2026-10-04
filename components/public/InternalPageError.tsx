"use client";

import { RotateCcw } from "lucide-react";

export function InternalPageError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="internal-error-page">
      <div className="page-width">
        <div className="internal-error-state" role="alert">
          <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />সমস্যা হয়েছে</p>
          <h1>পাতাটি লোড করা যায়নি</h1>
          <p>এই মুহূর্তে তথ্য দেখানো সম্ভব হচ্ছে না। আবার চেষ্টা করুন।</p>
          <button className="button button-primary" type="button" onClick={onRetry}>
            <RotateCcw size={16} aria-hidden="true" /> আবার চেষ্টা করুন
          </button>
        </div>
      </div>
    </main>
  );
}
