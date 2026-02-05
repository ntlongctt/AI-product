const CATEGORIES = [
  'All',
  'Fashion',
  'Food & Beverage',
  'Beauty',
  'Electronics',
  'Home & Living',
];

const DEMO_TEMPLATES = [
  { id: '1', name: 'Studio White', category: 'Fashion', uses: 1234 },
  { id: '2', name: 'Kitchen Scene', category: 'Food & Beverage', uses: 856 },
  { id: '3', name: 'Minimal Gradient', category: 'Beauty', uses: 623 },
  { id: '4', name: 'Dark Mode', category: 'Electronics', uses: 412 },
];

export default function TemplatesPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Templates</h1>
        <p className="text-muted-foreground">
          Choose a template to get started quickly
        </p>
      </div>

      {/* Categories */}
      <div className="mb-6 flex gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className="rounded-full border px-4 py-1 text-sm transition-colors hover:bg-accent first:bg-primary first:text-primary-foreground"
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {DEMO_TEMPLATES.map((template) => (
          <div
            key={template.id}
            className="group cursor-pointer overflow-hidden rounded-lg border transition-shadow hover:shadow-lg"
          >
            <div className="aspect-square bg-muted" />
            <div className="p-3">
              <h3 className="font-medium">{template.name}</h3>
              <p className="text-xs text-muted-foreground">
                {template.category} · {template.uses} uses
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
