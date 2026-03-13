import { useState } from 'react';
import { Plus, Search, Clock, MapPin, Users, Clapperboard, CheckCircle2, Circle, PlayCircle, Edit, Trash2, Copy } from 'lucide-react';
import { LiquidPage, LiquidCard, LiquidBadge, LiquidButton, LiquidInput, LiquidStatCard } from '../components/liquid-system';

interface Scene {
  id: string;
  number: string;
  title: string;
  type: 'INT' | 'EXT';
  timeOfDay: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK';
  location: string;
  pages: number;
  cast: string[];
  status: 'not-started' | 'in-progress' | 'wrapped';
  description: string;
  equipment: string[];
  props: string[];
  estimatedDuration: number;
  scheduledDate?: string;
}

const mockScenes: Scene[] = [
  {
    id: '1', number: '1', title: 'Opening - Hospital Corridor', type: 'INT', timeOfDay: 'DAY',
    location: 'Hospital - 2º Piso', pages: 2.5, cast: ['Dr. Sarah', 'Nurse Ana', 'Patient'],
    status: 'wrapped', description: 'Dr. Sarah walks through the busy corridor, discussing case with Ana.',
    equipment: ['Steadicam', 'LED Panel x4'], props: ['Medical charts', 'Coffee cup'],
    estimatedDuration: 120, scheduledDate: '2026-03-10',
  },
  {
    id: '2', number: '2A', title: 'Emergency Room - Code Blue', type: 'INT', timeOfDay: 'DAY',
    location: 'Hospital - ER', pages: 3.5, cast: ['Dr. Sarah', 'Dr. John', 'Nurse Ana', 'Nurse Pedro', 'Patient'],
    status: 'in-progress', description: 'High-intensity medical emergency with multiple cameras.',
    equipment: ['Camera A', 'Camera B', 'LED Panel x8', 'Smoke machine'],
    props: ['Defibrillator', 'Medical equipment', 'Hospital bed'],
    estimatedDuration: 180, scheduledDate: '2026-03-12',
  },
  {
    id: '3', number: '3', title: 'City Street - Chase', type: 'EXT', timeOfDay: 'NIGHT',
    location: 'Rua Augusta, Lisboa', pages: 4.0, cast: ['Detective Silva', 'Suspect', 'Extras x10'],
    status: 'not-started', description: 'Foot chase through crowded Lisbon street at night.',
    equipment: ['Drone', 'Gimbal', 'LED Lights x12', 'Walkie x20'],
    props: ['Police badge', 'Gun (prop)', 'Car'],
    estimatedDuration: 240, scheduledDate: '2026-03-15',
  },
  {
    id: '4', number: '4', title: 'Beach Sunrise - Final Scene', type: 'EXT', timeOfDay: 'DAWN',
    location: 'Praia de Carcavelos', pages: 1.5, cast: ['Dr. Sarah', 'Dr. John'],
    status: 'not-started', description: 'Emotional reconciliation scene at sunrise.',
    equipment: ['Camera A', 'Reflector', 'ND Filters'],
    props: ['Blanket', 'Coffee thermos'],
    estimatedDuration: 90, scheduledDate: '2026-03-18',
  },
];

export function Scenes() {
  const [scenes] = useState<Scene[]>(mockScenes);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | Scene['status']>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredScenes = scenes.filter((scene) => {
    const matchesSearch =
      scene.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scene.number.includes(searchQuery) ||
      scene.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || scene.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: scenes.length,
    wrapped: scenes.filter((s) => s.status === 'wrapped').length,
    inProgress: scenes.filter((s) => s.status === 'in-progress').length,
    notStarted: scenes.filter((s) => s.status === 'not-started').length,
    totalPages: scenes.reduce((acc, s) => acc + s.pages, 0),
  };

  const getStatusVariant = (status: Scene['status']): 'emerald' | 'blue' | 'default' => {
    switch (status) {
      case 'wrapped': return 'emerald';
      case 'in-progress': return 'blue';
      case 'not-started': return 'default';
    }
  };

  const getStatusIcon = (status: Scene['status']) => {
    switch (status) {
      case 'wrapped': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'in-progress': return <PlayCircle className="w-3.5 h-3.5" />;
      case 'not-started': return <Circle className="w-3.5 h-3.5" />;
    }
  };

  const getStatusLabel = (status: Scene['status']) => {
    switch (status) {
      case 'wrapped': return 'Wrapped';
      case 'in-progress': return 'In Progress';
      case 'not-started': return 'Not Started';
    }
  };

  return (
    <LiquidPage
      title="Scene Management"
      description="Manage all scenes and shooting schedule"
      headerAction={
        <LiquidButton
          onClick={() => setShowAddModal(true)}
          variant="emerald"
          pill
          glow
          icon={<Plus className="w-5 h-5" />}
        >
          Add Scene
        </LiquidButton>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Scenes', value: stats.total, variant: 'emerald' as const },
          { label: 'Wrapped', value: stats.wrapped, variant: 'emerald' as const },
          { label: 'In Progress', value: stats.inProgress, variant: 'blue' as const },
          { label: 'Not Started', value: stats.notStarted, variant: 'default' as const },
          { label: 'Total Pages', value: stats.totalPages.toFixed(1), variant: 'purple' as const },
        ].map((stat, i) => (
          <LiquidStatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            variant={stat.variant}
            animationDelay={i * 50}
            pulse={stat.variant === 'blue'}
          />
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <LiquidInput
            type="text"
            placeholder="Search scenes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4" />}
            radius="md"
          />
        </div>

        <div className="flex gap-2">
          {[
            { label: 'All', value: 'all' as const },
            { label: 'Wrapped', value: 'wrapped' as const },
            { label: 'In Progress', value: 'in-progress' as const },
            { label: 'Not Started', value: 'not-started' as const },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value)}
              className="px-4 py-3 rounded-[16px] transition-all"
              style={{
                background: filterStatus === filter.value
                  ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: filterStatus === filter.value
                  ? 'var(--fb-emerald)' : 'var(--fb-text-secondary)',
                border: filterStatus === filter.value
                  ? '0.5px solid rgba(16, 185, 129, 0.3)' : '0.5px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scenes List */}
      <div className="space-y-4">
        {filteredScenes.map((scene, index) => (
          <LiquidCard key={scene.id} intensity="subtle" radius="xl" animated animationDelay={index * 50} padding="24px">
            <div className="flex items-start justify-between gap-4">
              {/* Left: Scene Info */}
              <div className="flex-1 space-y-4">
                {/* Scene Number & Title */}
                <div className="flex items-start gap-4">
                  <div
                    className="flex-shrink-0 w-16 h-16 rounded-[14px] flex items-center justify-center"
                    style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '0.5px solid rgba(16, 185, 129, 0.2)',
                    }}
                  >
                    <span className="text-2xl font-black" style={{ color: 'var(--fb-emerald)' }}>{scene.number}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-white mb-1">{scene.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <LiquidBadge variant={scene.type === 'INT' ? 'blue' : 'amber'} size="sm">
                        {scene.type}
                      </LiquidBadge>
                      <LiquidBadge variant="default" size="sm">
                        {scene.timeOfDay}
                      </LiquidBadge>
                      <LiquidBadge variant={getStatusVariant(scene.status)} size="sm" icon={getStatusIcon(scene.status)}>
                        {getStatusLabel(scene.status)}
                      </LiquidBadge>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[var(--fb-text-secondary)] text-sm leading-relaxed">{scene.description}</p>

                {/* Meta Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--fb-emerald)' }} />
                    <span className="text-[var(--fb-text-secondary)] truncate">{scene.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clapperboard className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--fb-info)' }} />
                    <span className="text-[var(--fb-text-secondary)]">{scene.pages} pages</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 flex-shrink-0" style={{ color: '#a855f7' }} />
                    <span className="text-[var(--fb-text-secondary)]">{scene.cast.length} cast</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
                    <span className="text-[var(--fb-text-secondary)]">{scene.estimatedDuration}min</span>
                  </div>
                </div>

                {/* Cast & Equipment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>CAST</div>
                    <div className="flex flex-wrap gap-1.5">
                      {scene.cast.map((actor) => (
                        <LiquidBadge key={actor} variant="purple" size="sm">{actor}</LiquidBadge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>EQUIPMENT</div>
                    <div className="flex flex-wrap gap-1.5">
                      {scene.equipment.slice(0, 3).map((item) => (
                        <LiquidBadge key={item} variant="blue" size="sm">{item}</LiquidBadge>
                      ))}
                      {scene.equipment.length > 3 && (
                        <LiquidBadge variant="default" size="sm">
                          +{scene.equipment.length - 3} more
                        </LiquidBadge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex flex-col gap-2">
                {[
                  { icon: Edit, hoverColor: 'var(--fb-emerald)' },
                  { icon: Copy, hoverColor: 'var(--fb-info)' },
                  { icon: Trash2, hoverColor: '#ef4444' },
                ].map(({ icon: Icon, hoverColor }, i) => (
                  <button
                    key={i}
                    className="p-2 rounded-[12px] transition-all"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '0.5px solid rgba(255, 255, 255, 0.1)',
                      color: 'var(--fb-text-secondary)',
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
          </LiquidCard>
        ))}
      </div>

      {/* Empty State */}
      {filteredScenes.length === 0 && (
        <div className="text-center py-16">
          <Clapperboard className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--fb-text-tertiary)' }} />
          <h3 className="text-xl font-black mb-2" style={{ color: 'var(--fb-text-secondary)' }}>No scenes found</h3>
          <p style={{ color: 'var(--fb-text-tertiary)' }}>Try adjusting your search or filters</p>
        </div>
      )}

      {/* Add Scene Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="relative w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <LiquidCard intensity="heavy" radius="xl" lensing padding="32px">
              <h2 className="text-2xl font-black text-white mb-6">Add New Scene</h2>
              <p className="text-[var(--fb-text-secondary)] mb-8">Modal form coming soon...</p>
              <LiquidButton onClick={() => setShowAddModal(false)} variant="emerald">
                Close
              </LiquidButton>
            </LiquidCard>
          </div>
        </div>
      )}
    </LiquidPage>
  );
}