import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = React.createContext<TabsContextValue>({
  activeTab: '',
  setActiveTab: () => {},
});

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

function Tabs({ defaultValue = '', value, onValueChange, className, children, ...props }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(value ?? defaultValue);

  React.useEffect(() => {
    if (value !== undefined) setActiveTab(value);
  }, [value]);

  const handleSetTab = (tab: string) => {
    setActiveTab(tab);
    onValueChange?.(tab);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleSetTab }}>
      <div className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'inline-flex h-9 items-center rounded-lg bg-gray-100 p-1 text-gray-500',
        className,
      )}
      {...props}
    />
  );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

function TabsTrigger({ className, value, ...props }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = React.useContext(TabsContext);
  const isActive = activeTab === value;

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium',
        'transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        isActive ? 'bg-white text-gray-900 shadow' : 'hover:bg-gray-200',
        className,
      )}
      onClick={() => setActiveTab(value)}
      {...props}
    />
  );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function TabsContent({ className, value, ...props }: TabsContentProps) {
  const { activeTab } = React.useContext(TabsContext);
  if (activeTab !== value) return null;
  return <div className={cn('mt-4', className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
