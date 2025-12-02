import React from 'react';
import { Check } from 'lucide-react';

interface Step {
  id: number;
  name: string;
  path: string;
}

interface ProgressStepperProps {
  currentStep: number;
  steps: Step[];
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({ currentStep, steps }) => {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step Circle */}
            <div className="flex flex-col items-center flex-1">
              <div className="flex items-center w-full">
                {/* Line before (except first) */}
                {index > 0 && (
                  <div
                    className={`h-1 flex-1 transition-colors ${
                      currentStep >= step.id ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  />
                )}

                {/* Circle */}
                <div
                  className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                    currentStep > step.id
                      ? 'bg-primary border-primary text-white'
                      : currentStep === step.id
                      ? 'bg-white border-primary text-primary'
                      : 'bg-white border-gray-300 text-gray-500'
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-semibold">{step.id}</span>
                  )}
                </div>

                {/* Line after (except last) */}
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 flex-1 transition-colors ${
                      currentStep > step.id ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>

              {/* Step Label */}
              <div className="mt-2 text-center">
                <p
                  className={`text-sm font-medium ${
                    currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {step.name}
                </p>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
