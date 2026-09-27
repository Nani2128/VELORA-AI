import React, { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { MediaCard } from '../features/library/MediaCard';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/common/EmptyState';
import { LayoutGrid, List, Search, Library, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const LibraryPage: React.FC = () => {
  const { 
    assets, 
    loadLibrary,
    assetFilter, 
    setAssetFilter, 
    assetSearch, 
    setAssetSearch, 
    viewMode, 
    setViewMode,
    navigate 
  } = useAppStore();

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const filteredAssets = assets.filter((asset) => {
    const matchesFilter = assetFilter === 'ALL' || asset.type === assetFilter;
    const matchesSearch = 
      asset.title.toLowerCase().includes(assetSearch.toLowerCase()) ||
      asset.prompt.toLowerCase().includes(assetSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider font-mono-numbers">
            Media Repository
          </span>
          <h1 className="text-2xl font-display font-extrabold text-white mt-0.5">
            Studio Library
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse and export all high-resolution images, video sequences, and project assets.
          </p>
        </div>

        <Button
          size="md"
          variant="primary"
          onClick={() => navigate('/app/create')}
          leftIcon={<Sparkles className="w-4 h-4" />}
        >
          New Creation
        </Button>
      </div>

      {/* Control Bar: Search + Filter + View Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="w-full md:w-80">
          <Input
            value={assetSearch}
            onChange={(e) => setAssetSearch(e.target.value)}
            placeholder="Search prompt, title, or tags..."
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            value={assetFilter}
            onChange={setAssetFilter}
            options={[
              { value: 'ALL', label: 'All Assets', badge: assets.length },
              { value: 'IMAGE', label: 'Images', badge: assets.filter((a) => a.type === 'IMAGE').length },
              { value: 'VIDEO', label: 'Videos', badge: assets.filter((a) => a.type === 'VIDEO').length },
            ]}
          />

          <div className="hidden sm:flex items-center bg-[#10131B] border border-white/10 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-[#1E2333] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Grid view"
              aria-label="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-[#1E2333] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="List view"
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Gallery */}
      {filteredAssets.length === 0 ? (
        <EmptyState
          icon={<Library className="w-6 h-6" />}
          title={assetSearch ? 'No assets found' : 'Your media library is empty'}
          description={
            assetSearch
              ? 'Try searching with different keywords or switch the filter tab.'
              : 'Synthesize images or direct video clips in the Studio Canvas to populate your library.'
          }
          actionLabel="Open Studio"
          onAction={() => navigate('/app/create')}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssets.map((asset) => (
            <MediaCard key={asset.id} asset={asset} viewMode="grid" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredAssets.map((asset) => (
            <MediaCard key={asset.id} asset={asset} viewMode="list" />
          ))}
        </div>
      )}
    </div>
  );
};
