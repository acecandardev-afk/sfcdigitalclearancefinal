import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileCheck, GraduationCap, Shield, Users, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [course, setCourse] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(loginEmail, loginPassword);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Welcome back!');
      navigate('/dashboard');
    }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!fullName || !signupEmail || !signupPassword) {
      toast.error('Please fill in all required fields');
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(signupEmail, signupPassword, fullName, studentId, yearLevel, course);
    
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please sign in instead.');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Account created successfully!');
      navigate('/dashboard');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-pink-50 to-blue-50 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 flex relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 dark:bg-purple-500 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-pink-300 dark:bg-pink-500 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/3 w-72 h-72 bg-blue-300 dark:bg-blue-500 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 text-slate-800 dark:text-white relative z-10">
        <div className="max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-gradient-to-br from-violet-400 to-purple-600 dark:from-violet-500 dark:to-purple-700 rounded-2xl shadow-lg backdrop-blur-sm transform hover:scale-105 transition-transform">
              <FileCheck className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
              Saint Francis College Guihulngan
            </h1>
          </div>
          <div className="mb-6 flex items-center gap-2">
            
            <p className="text-xl font-semibold text-violet-600 dark:text-violet-300">
              Digital Clearance System
            </p>
          </div>
          <p className="text-lg text-slate-700 dark:text-slate-300 mb-12 leading-relaxed">
            Simplify your academic clearance process with ease and efficiency. Modern, fast, and reliable.
          </p>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-shadow animate-slide-up border border-violet-200 dark:border-purple-700" style={{ animationDelay: '0.1s' }}>
              <div className="p-2 bg-gradient-to-br from-violet-400 to-purple-500 rounded-lg shadow-md">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-violet-900 dark:text-violet-200">Student Registration</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Register with your student ID and course details</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-shadow animate-slide-up border border-pink-200 dark:border-pink-700" style={{ animationDelay: '0.2s' }}>
              <div className="p-2 bg-gradient-to-br from-pink-400 to-rose-500 rounded-lg shadow-md">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-pink-900 dark:text-pink-200">Select Signatories</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Choose required department heads for approval</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-shadow animate-slide-up border border-blue-200 dark:border-blue-700" style={{ animationDelay: '0.3s' }}>
              <div className="p-2 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg shadow-md">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-blue-900 dark:text-blue-200">Real-time Tracking</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Monitor your clearance status in real-time</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative z-10">
        <Card className="w-full max-w-md shadow-2xl animate-scale-in bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-2 border-violet-200 dark:border-purple-700">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 mb-4 lg:hidden">
              <div className="p-2 bg-gradient-to-br from-violet-400 to-purple-600 rounded-xl shadow-lg">
                <FileCheck className="h-8 w-8 text-white" />
              </div>
              <span className="text-2xl font-display font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
                Saint Francis College - Guihulngan - Digital Clearance
              </span>
            </div>
            <CardTitle className="text-3xl font-display bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
              Welcome
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Sign in to your account or register as a student
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-violet-100 dark:bg-slate-800 p-1">
                <TabsTrigger 
                  value="login"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="signup"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-slate-700 dark:text-slate-300 font-medium">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="student@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="border-violet-200 dark:border-purple-700 focus:border-violet-400 dark:focus:border-purple-500 focus:ring-violet-400 dark:focus:ring-purple-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-slate-700 dark:text-slate-300 font-medium">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="border-violet-200 dark:border-purple-700 focus:border-violet-400 dark:focus:border-purple-500 focus:ring-violet-400 dark:focus:ring-purple-500"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all" 
                    size="lg" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full-name" className="text-slate-700 dark:text-slate-300 font-medium">Full Name *</Label>
                    <Input
                      id="full-name"
                      type="text"
                      placeholder="Juan Dela Cruz"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="border-violet-200 dark:border-purple-700 focus:border-violet-400 dark:focus:border-purple-500 focus:ring-violet-400 dark:focus:ring-purple-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-id" className="text-slate-700 dark:text-slate-300 font-medium">Student ID</Label>
                    <Input
                      id="student-id"
                      type="text"
                      placeholder="23-0456-A"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="border-violet-200 dark:border-purple-700 focus:border-violet-400 dark:focus:border-purple-500 focus:ring-violet-400 dark:focus:ring-purple-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="year-level" className="text-slate-700 dark:text-slate-300 font-medium">Year Level</Label>
                      <Select value={yearLevel} onValueChange={setYearLevel}>
                        <SelectTrigger className="border-violet-200 dark:border-purple-700 focus:border-violet-400 dark:focus:border-purple-500 focus:ring-violet-400 dark:focus:ring-purple-500">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4th Year">4th Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department" className="text-slate-700 dark:text-slate-300 font-medium">Department</Label>
                      <Select value={course} onValueChange={setCourse}>
                        <SelectTrigger className="border-violet-200 dark:border-purple-700 focus:border-violet-400 dark:focus:border-purple-500 focus:ring-violet-400 dark:focus:ring-purple-500">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="College of Computer Studies">College of Computer Studies</SelectItem>
                          <SelectItem value="College of Business Administration">College of Business Administration</SelectItem>
                          <SelectItem value="College of Education">College of Education</SelectItem>
                          <SelectItem value="College of Engineering">College of Engineering</SelectItem>
                          <SelectItem value="College of Arts and Sciences">College of Arts and Sciences</SelectItem>
                          <SelectItem value="College of Nursing">College of Nursing</SelectItem>
                          <SelectItem value="College of Accountancy">College of Accountancy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-slate-700 dark:text-slate-300 font-medium">Email *</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="student@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      className="border-violet-200 dark:border-purple-700 focus:border-violet-400 dark:focus:border-purple-500 focus:ring-violet-400 dark:focus:ring-purple-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-slate-700 dark:text-slate-300 font-medium">Password *</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      minLength={6}
                      className="border-violet-200 dark:border-purple-700 focus:border-violet-400 dark:focus:border-purple-500 focus:ring-violet-400 dark:focus:ring-purple-500"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all" 
                    size="lg" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}