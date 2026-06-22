import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { friendlyFetchError, friendlySignInError } from '@/lib/userMessages';
import { Loader2, Mail, Lock, ArrowLeft } from 'lucide-react';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const navigate = useNavigate();
  const { signIn, resetPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error(friendlySignInError(error.message));
    } else {
      toast.success('Welcome back!');
      onOpenChange(false);
      navigate('/dashboard');
    }
    setIsLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Enter your email address');
      return;
    }
    setIsLoading(true);
    const { error } = await resetPassword(email.trim());
    if (error) {
      toast.error(friendlyFetchError(error, 'Could not send the reset email. Try again or contact your administrator.'));
    } else {
      setForgotSent(true);
      toast.success('Check your email for the reset link');
    }
    setIsLoading(false);
  };

  const close = () => {
    setShowForgot(false);
    setForgotSent(false);
    setPassword('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); else onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[400px] gap-0 p-0 overflow-hidden border-border/50 shadow-elevated bg-card">
        <DialogHeader className="p-6 pb-4 space-y-1">
          <DialogTitle className="text-xl font-display font-semibold">
            {showForgot ? (forgotSent ? 'Check your email' : 'Reset password') : 'Sign in'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {showForgot
              ? forgotSent
                ? 'We sent a link to your email. Use it to set a new password.'
                : 'Enter your email and we’ll send you a link to reset your password.'
              : 'Use the account created for you by the administrator.'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {showForgot ? (
            forgotSent ? (
              <div className="space-y-4">
                <Button className="w-full" onClick={() => { setShowForgot(false); setForgotSent(false); }}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="modal-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="modal-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForgot(false)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
                  </Button>
                </div>
              </form>
            )
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modal-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="modal-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="modal-password">Password</Label>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setShowForgot(true)}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <PasswordInput
                    id="modal-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
