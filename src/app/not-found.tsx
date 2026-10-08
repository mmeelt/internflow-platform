import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";

export default function NotFound() {
  return (
    <PageTransition>
      <div className="flex-1 flex flex-col items-center justify-center min-h-[80vh] p-8 text-center">
        <div className="w-20 h-20 bg-cream-dark rounded-3xl flex items-center justify-center mb-6 border border-border shadow-sm transform -rotate-6">
          <FileQuestion className="w-10 h-10 text-muted" />
        </div>
        <h1 className="text-4xl font-black text-charcoal tracking-tight mb-3">Page Not Found</h1>
        <p className="text-muted text-base max-w-md mx-auto mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved. Check the URL or navigate back to your dashboard.
        </p>
        <Link 
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-charcoal text-white rounded-xl font-medium hover:bg-charcoal-soft transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
        >
          <Home className="w-4 h-4" />
          Return to Dashboard
        </Link>
      </div>
    </PageTransition>
  );
}
