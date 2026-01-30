import { useState } from 'react';
import { Check, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Signatory {
  id: string;
  name: string;
  position: string;
  department: string;
}

interface SelectedSignatory extends Signatory {
  order: number;
}

interface SignatorySelectorProps {
  signatories: Signatory[];
  selectedSignatories: SelectedSignatory[];
  onSelectionChange: (selected: SelectedSignatory[]) => void;
}

export default function SignatorySelector({
  signatories,
  selectedSignatories,
  onSelectionChange,
}: SignatorySelectorProps) {
  // Group signatories by department
  const groupedSignatories = signatories.reduce((acc, sig) => {
    if (!acc[sig.department]) {
      acc[sig.department] = [];
    }
    acc[sig.department].push(sig);
    return acc;
  }, {} as Record<string, Signatory[]>);

  const isSelected = (id: string) => selectedSignatories.some((s) => s.id === id);

  const toggleSignatory = (signatory: Signatory) => {
    if (isSelected(signatory.id)) {
      // Remove from selection
      const updated = selectedSignatories
        .filter((s) => s.id !== signatory.id)
        .map((s, index) => ({ ...s, order: index + 1 }));
      onSelectionChange(updated);
    } else {
      // Add to selection with next order number
      const newOrder = selectedSignatories.length + 1;
      onSelectionChange([
        ...selectedSignatories,
        { ...signatory, order: newOrder },
      ]);
    }
  };

  const moveUp = (id: string) => {
    const index = selectedSignatories.findIndex((s) => s.id === id);
    if (index <= 0) return;
    
    const updated = [...selectedSignatories];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onSelectionChange(updated.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const moveDown = (id: string) => {
    const index = selectedSignatories.findIndex((s) => s.id === id);
    if (index < 0 || index >= selectedSignatories.length - 1) return;
    
    const updated = [...selectedSignatories];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onSelectionChange(updated.map((s, i) => ({ ...s, order: i + 1 })));
  };

  return (
    <div className="space-y-6">
      {/* Available Signatories by Department */}
      <div className="space-y-6">
        {Object.entries(groupedSignatories).map(([department, sigs]) => (
          <div key={department}>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">
              {department}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sigs.map((sig) => {
                const selected = isSelected(sig.id);
                const selectedItem = selectedSignatories.find((s) => s.id === sig.id);
                return (
                  <div
                    key={sig.id}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                    onClick={() => toggleSignatory(sig)}
                  >
                    <div
                      className={`h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background flex items-center justify-center ${
                        selected ? 'bg-primary text-primary-foreground' : ''
                      }`}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{sig.name}</p>
                      <p className="text-sm text-muted-foreground">{sig.position}</p>
                    </div>
                    {selectedItem && (
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {selectedItem.order}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Signatories Order */}
      {selectedSignatories.length > 0 && (
        <div className="border-t border-border pt-6">
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">
            Signing Sequence (drag to reorder)
          </h4>
          <p className="text-xs text-muted-foreground mb-4">
            Signatories must sign in this order. Each signatory can only sign after the previous one has approved.
          </p>
          <div className="space-y-2">
            {selectedSignatories.map((sig, index) => (
              <div
                key={sig.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {sig.order}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{sig.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {sig.position} • {sig.department}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveUp(sig.id);
                    }}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveDown(sig.id);
                    }}
                    disabled={index === selectedSignatories.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
