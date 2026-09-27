import React, { useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { BrandLogo } from '../components/common/BrandLogo';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Lock, Mail, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { navigate, addToast } = useAppStore();
  const [email, setEmail] = useState('elena@velorastudio.ai');
  const [password, setPassword] = useState('••••••••••••');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addToast({
      type: 'success',
      title: 'Studio Access Granted',
      message: 'Welcome back to your VELORA creative suite.',
    });
    navigate('/app');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md p-8 rounded-3xl bg-[#0F121C] border border-white/10 shadow-2xl flex flex-col gap-6">
        <div className="flex flex-col items-center text-center">
          <BrandLogo size="md" />
          <h2 className="text-xl font-bold text-white mt-4">Welcome to VELORA Studio</h2>
          <p className="text-xs text-slate-400 mt-1">Sign in to your creative workspace and production pipeline.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />

          <div className="flex items-center justify-between text-xs text-slate-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded border-white/20 bg-white/5 accent-amber-500" />
              <span>Remember studio credentials</span>
            </label>
            <button type="button" className="hover:text-white transition-colors cursor-pointer">
              Forgot password?
            </button>
          </div>

          <Button type="submit" size="md" className="w-full mt-2" rightIcon={<ArrowRight className="w-4 h-4" />}>
            Sign In to Studio
          </Button>
        </form>

        <div className="text-center text-xs text-slate-400 pt-2 border-t border-white/5">
          <span>Don't have a studio account? </span>
          <button
            onClick={() => navigate('/signup')}
            className="text-amber-400 font-semibold hover:underline cursor-pointer"
          >
            Create an Account
          </button>
        </div>
      </div>
    </div>
  );
};

export const SignupPage: React.FC = () => {
  const { navigate, addToast } = useAppStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addToast({
      type: 'success',
      title: 'Studio Account Created',
      message: 'Welcome to VELORA AI. Your creative workspace is initialized.',
    });
    navigate('/app');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md p-8 rounded-3xl bg-[#0F121C] border border-white/10 shadow-2xl flex flex-col gap-6">
        <div className="flex flex-col items-center text-center">
          <BrandLogo size="md" />
          <h2 className="text-xl font-bold text-white mt-4">Create Studio Account</h2>
          <p className="text-xs text-slate-400 mt-1">Join the next-generation AI image & video creation studio.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Full Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Elena Rostova"
            required
          />
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@studio.com"
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />
          <Input
            label="Create Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />

          <Button type="submit" size="md" className="w-full mt-2" rightIcon={<ArrowRight className="w-4 h-4" />}>
            Initialize Studio
          </Button>
        </form>

        <div className="text-center text-xs text-slate-400 pt-2 border-t border-white/5">
          <span>Already have an account? </span>
          <button
            onClick={() => navigate('/login')}
            className="text-amber-400 font-semibold hover:underline cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
