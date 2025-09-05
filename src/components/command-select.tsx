import { ReactNode, useState } from "react";
import { Button } from "./ui/button";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandInput, CommandItem, CommandResponsiveDialog } from "./ui/command";
import { CommandEmpty, CommandList } from "cmdk";

interface Props {
  options: Array<{
    id: string;
    value: string;
    children: ReactNode;
  }>;
  onSelect: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  value: string;
  inSearchable?: boolean;
  className?: string;
}

export const CommandSelect = ({
  options,
  onSelect,
  onSearch,
  value,
  placeholder = "Select as an Option",
  inSearchable,
  className,
}: Props) => {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  return (
    <>
      <Button
        onClick={()=>setOpen(true)}
        type="button"
        variant="outline"
        className={cn(
          "h-9 justify-between font-normal px-2",
          !selectedOption && "text-muted-foreground",
          className
        )}
      >
        <div className={className}>
          {selectedOption?.children ?? placeholder}
        </div>
        <ChevronDownIcon />
      </Button>
      <CommandResponsiveDialog open={open} onOpenChange={setOpen} shouldFilter={!onSearch}>
        <CommandInput placeholder="Search..." onValueChange={onSearch} />
        <CommandList>
            <CommandEmpty>
                <span className="text-muted-foreground text-sm">
                    No Options Found
                </span>
            </CommandEmpty>
            {options.map((option)=>(
                <CommandItem 
                    key={option.id}
                    onSelect={()=>{
                        onSelect(option.value)
                        setOpen(false);
                    }}
                    >
                    {option.children}
                </CommandItem>
            ))}
        </CommandList>
      </CommandResponsiveDialog>
    </>
  );
};
