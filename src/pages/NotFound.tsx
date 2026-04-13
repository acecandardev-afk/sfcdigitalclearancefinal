import { Link } from 'react-router-dom';

/**
 * Shown when no React Router path matches. Keep copy generic (no paths or internals in production UI).
 */
const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="text-center max-w-md">
        <h1 className="mb-2 text-4xl font-bold text-[#1a3c5e] dark:text-blue-400">404</h1>
        <p className="mb-6 text-lg text-muted-foreground">We could not find that page.</p>
        <Link
          to="/"
          className="inline-flex text-primary underline underline-offset-4 hover:text-primary/90 font-medium"
        >
          Return to home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
