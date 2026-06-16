"use client";
import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { cn } from "@/lib/utils";
const Accordion = AccordionPrimitive.Root;
function AccordionItem({ className, ref, ...props }: React.ComponentPropsWithRef<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item ref={ref} className={cn("border-b", className)} {...props} />;
}
AccordionItem.displayName = "AccordionItem";
export { AccordionTrigger } from "./accordion-trigger";
export { AccordionContent } from "./accordion-content";
export { Accordion, AccordionItem };
