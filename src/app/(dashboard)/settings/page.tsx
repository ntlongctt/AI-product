import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Profile</h2>
        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              placeholder="you@example.com"
              disabled
            />
          </div>
          <Button>Save Changes</Button>
        </div>
      </section>

      {/* Download Preferences */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Download Preferences</h2>
        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <label className="text-sm font-medium">Default Format</label>
            <select className="mt-1 w-full rounded-md border bg-background px-3 py-2">
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">JPEG Quality</label>
            <input
              type="range"
              min="70"
              max="100"
              defaultValue="95"
              className="mt-1 w-full"
            />
            <span className="text-sm text-muted-foreground">95%</span>
          </div>
        </div>
      </section>

      {/* Subscription */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Subscription</h2>
        <div className="rounded-lg border p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-medium">Free Plan</p>
              <p className="text-sm text-muted-foreground">3/10 generations used this month</p>
            </div>
            <Button>Upgrade</Button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[30%] bg-primary" />
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-destructive">Danger Zone</h2>
        <div className="rounded-lg border border-destructive/50 p-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Once you delete your account, there is no going back.
          </p>
          <Button variant="destructive">Delete Account</Button>
        </div>
      </section>
    </div>
  );
}
