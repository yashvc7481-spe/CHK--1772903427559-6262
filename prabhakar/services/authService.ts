import { User, UserRole } from '../types';

const USERS_KEY   = 'gms_users';
const SESSION_KEY = 'gms_session';

const hashPassword = async (p: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const seedUsers = async () => {
  if (localStorage.getItem(USERS_KEY)) return;
  const [adminPass, supervisorPass, officerPass, citizenPass] = await Promise.all([
    hashPassword('admin123'),
    hashPassword('supervisor123'),
    hashPassword('officer123'),
    hashPassword('citizen123'),
  ]);
  const users: User[] = [
    { id: 'admin-1',      name: 'District Administrator',  email: 'admin@gov.in',       role: UserRole.ADMIN,      department: 'Administration', passwordHash: adminPass },
    { id: 'supervisor-1', name: 'Dept. Supervisor',        email: 'supervisor@gov.in',  role: UserRole.SUPERVISOR, department: 'Public Works',   passwordHash: supervisorPass },
    { id: 'officer-1',    name: 'Field Officer (Ramesh)',  email: 'officer@gov.in',     role: UserRole.OFFICER,    department: 'Public Works',   passwordHash: officerPass },
    { id: 'citizen-1',    name: 'Priya Sharma',            email: 'citizen@example.com',role: UserRole.CITIZEN,                                  passwordHash: citizenPass },
  ];
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

seedUsers().catch(console.error);

const getUsers   = (): User[]       => { const s = localStorage.getItem(USERS_KEY); return s ? JSON.parse(s) : []; };
const saveUsers  = (u: User[]) => localStorage.setItem(USERS_KEY, JSON.stringify(u));

export const authService = {
  async login(email: string, password: string): Promise<User> {
    await new Promise(r => setTimeout(r, 350));
    const users = getUsers();
    const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user?.passwordHash) throw new Error('Invalid email or password');
    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) throw new Error('Invalid email or password');
    const { passwordHash, ...safe } = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
    return safe;
  },

  async register(name: string, email: string, password: string, role: UserRole): Promise<User> {
    await new Promise(r => setTimeout(r, 350));
    const users = getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase()))
      throw new Error('An account with this email already exists.');
    const hash = await hashPassword(password);
    const newUser: User = {
      id: `user-${Math.random().toString(36).substring(7)}`,
      name, email, role, passwordHash: hash,
    };
    users.push(newUser);
    saveUsers(users);
    const { passwordHash, ...safe } = newUser;
    localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
    return safe;
  },

  getCurrentUser(): User | null {
    const s = localStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  },

  logout() { localStorage.removeItem(SESSION_KEY); },

  getStaff(): User[] {
    return getUsers().filter(u => u.role === UserRole.OFFICER || u.role === UserRole.SUPERVISOR || u.role === UserRole.ADMIN);
  },

  getAdmins(): User[] { return getUsers().filter(u => u.role === UserRole.ADMIN); },

  getAllUsers(): User[] { return getUsers(); },
};

