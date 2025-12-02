import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authenticatedFetch } from '@/lib/api';
import { useToast } from '@/components/Toaster';

const Profile: React.FC = () => {
    const { user, signOut } = useAuth();
    const toast = useToast();

    const testApi = async () => {
        try {
            console.log('Testing authenticated API call...');
            const response = await authenticatedFetch('/api/profile');
            const data = await response.json();
            console.log('API Response:', data);

            toast.show({
                variant: 'success',
                title: 'API Connection Successful',
                message: `Authenticated as: ${data.email}`,
                duration: 3000
            });
        } catch (error) {
            console.error('API Error:', error);
            toast.show({
                variant: 'error',
                title: 'API Connection Failed',
                message: 'Check console for details.',
                duration: 4000
            });
        }
    };

    const deleteAccount = async () => {
        if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;

        try {
            const response = await authenticatedFetch('/api/user', { method: 'DELETE' });
            if (response.ok) {
                toast.show({
                    variant: 'success',
                    title: 'Account Deleted',
                    message: 'Your account has been permanently deleted.',
                    duration: 3000
                });
                signOut();
            } else {
                throw new Error('Failed to delete account');
            }
        } catch (error) {
            console.error('Delete Error:', error);
            toast.show({
                variant: 'error',
                title: 'Delete Failed',
                message: 'Could not delete account. Try again later.',
                duration: 4000
            });
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-2xl space-y-6">
            <h1 className="text-3xl font-bold">Profile</h1>

            <Card>
                <CardHeader>
                    <CardTitle>User Information</CardTitle>
                    <CardDescription>Manage your account details and session.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="font-medium text-muted-foreground">Email</div>
                        <div>{user?.email}</div>

                        <div className="font-medium text-muted-foreground">User ID</div>
                        <div className="font-mono text-xs">{user?.uid}</div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Developer Tools</CardTitle>
                    <CardDescription>Utilities for testing your session.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm">
                            <div className="font-medium">Test API Connection</div>
                            <div className="text-muted-foreground">Verify that your token is valid and being sent correctly.</div>
                        </div>
                        <Button onClick={testApi} variant="outline">Test API</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Security</CardTitle>
                    <CardDescription>Update your password.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const password = (form.elements.namedItem('password') as HTMLInputElement).value;
                        if (password.length < 6) {
                            toast.show({ variant: 'error', title: 'Invalid Password', message: 'Password must be at least 6 characters.', duration: 3000 });
                            return;
                        }
                        try {
                            const res = await authenticatedFetch('/api/user', {
                                method: 'PUT',
                                body: JSON.stringify({ password })
                            });
                            if (res.ok) {
                                toast.show({ variant: 'success', title: 'Password Updated', message: 'Your password has been changed.', duration: 3000 });
                                form.reset();
                            } else {
                                throw new Error('Failed to update password');
                            }
                        } catch (err) {
                            toast.show({ variant: 'error', title: 'Update Failed', message: 'Could not update password.', duration: 3000 });
                        }
                    }}>
                        <div className="flex gap-4 items-end">
                            <div className="grid w-full max-w-sm items-center gap-1.5">
                                <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">New Password</label>
                                <input type="password" id="password" name="password" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="New password" />
                            </div>
                            <Button type="submit">Update</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card className="border-red-200 dark:border-red-900">
                <CardHeader>
                    <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
                    <CardDescription>Irreversible account actions.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="text-sm">
                            <div className="font-medium">Delete Account</div>
                            <div className="text-muted-foreground">Permanently remove your account and all data.</div>
                        </div>
                        <Button onClick={deleteAccount} variant="destructive">Delete Account</Button>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button variant="outline" onClick={signOut}>Sign Out</Button>
            </div>
        </div>
    );
};

export default Profile;
