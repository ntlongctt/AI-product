import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ASSET_TABS = ['All', 'Models', 'Products', 'Backgrounds', 'Brand'];

export default function AssetsPage() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Asset Library</h1>
          <p className="text-muted-foreground">
            Store and organize your images
          </p>
        </div>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b">
        {ASSET_TABS.map((tab) => (
          <button
            key={tab}
            className="border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-colors hover:text-primary first:border-primary first:text-primary"
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
        <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
        <p className="font-medium">Drop files here</p>
        <p className="text-sm text-muted-foreground">PNG, JPG, WEBP up to 20MB</p>
      </div>
    </div>
  );
}
