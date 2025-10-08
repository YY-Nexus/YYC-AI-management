"use client";

import React from "react";
import {
  useI18n,
  I18nText,
  I18nButton,
  I18nLabel,
  I18nInput,
} from "../components/i18n/i18n-components";
import {
  I18nNavigationHeader,
  I18nNavigationContainer,
} from "../components/i18n/i18n-navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function I18nDemoPage() {
  const { t, formatDate, formatCurrency, formatNumber, isRTL } = useI18n();

  const currentDate = new Date();
  const sampleAmount = 12345.67;
  const sampleNumber = 123456789;

  return (
    <I18nNavigationContainer className="min-h-screen bg-background">
      <div className="flex flex-col w-full">
        <I18nNavigationHeader />

        <main className="flex-1 p-6 space-y-6">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>
                  <I18nText
                    tKey="demo.title"
                    fallback="Internationalization Demo"
                  />
                </CardTitle>
                <CardDescription>
                  <I18nText
                    tKey="demo.description"
                    fallback="This page demonstrates the i18n capabilities of the system"
                  />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Text */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">
                    <I18nText
                      tKey="demo.sections.basicText"
                      fallback="Basic Text Translation"
                    />
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        Navigation Items:
                      </p>
                      <ul className="space-y-1">
                        <li>
                          <I18nText tKey="nav.dashboard" fallback="Dashboard" />
                        </li>
                        <li>
                          <I18nText tKey="nav.orders" fallback="Orders" />
                        </li>
                        <li>
                          <I18nText tKey="nav.inventory" fallback="Inventory" />
                        </li>
                        <li>
                          <I18nText tKey="nav.reports" fallback="Reports" />
                        </li>
                      </ul>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        Common Actions:
                      </p>
                      <ul className="space-y-1">
                        <li>
                          <I18nText tKey="common.save" fallback="Save" />
                        </li>
                        <li>
                          <I18nText tKey="common.cancel" fallback="Cancel" />
                        </li>
                        <li>
                          <I18nText tKey="common.delete" fallback="Delete" />
                        </li>
                        <li>
                          <I18nText tKey="common.edit" fallback="Edit" />
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Formatting Examples */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">
                    <I18nText
                      tKey="demo.sections.formatting"
                      fallback="Localized Formatting"
                    />
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        Date Formatting:
                      </p>
                      <p
                        className="font-mono text-sm"
                        data-testid="date-display"
                      >
                        {formatDate(currentDate)}
                      </p>
                      <p className="font-mono text-sm mt-1">
                        {formatDate(currentDate, { dateStyle: "short" })}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        Currency Formatting:
                      </p>
                      <p
                        className="font-mono text-sm"
                        data-testid="currency-display"
                      >
                        {formatCurrency(sampleAmount)}
                      </p>
                      <p className="font-mono text-sm mt-1">
                        {formatCurrency(sampleAmount, "USD")}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        Number Formatting:
                      </p>
                      <p
                        className="font-mono text-sm"
                        data-testid="number-display"
                      >
                        {formatNumber(sampleNumber)}
                      </p>
                      <p className="font-mono text-sm mt-1">
                        {formatNumber(sampleNumber / 100, { style: "percent" })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RTL Demo */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">
                    <I18nText
                      tKey="demo.sections.rtl"
                      fallback="RTL Layout Support"
                    />
                  </h3>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">
                      Current Direction:{" "}
                      {isRTL ? "Right-to-Left (RTL)" : "Left-to-Right (LTR)"}
                    </p>
                    <div className="flex items-center space-x-2">
                      <span>Start</span>
                      <div className="flex-1 border-t border-dashed"></div>
                      <span>End</span>
                    </div>
                  </div>
                </div>

                {/* Form Demo */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">
                    <I18nText
                      tKey="demo.sections.forms"
                      fallback="Form Components"
                    />
                  </h3>
                  <div className="p-4 bg-muted rounded-lg space-y-4">
                    <div className="space-y-2">
                      <I18nLabel
                        tKey="form.name"
                        fallback="Name"
                        required
                        htmlFor="demo-name"
                      />
                      <I18nInput
                        id="demo-name"
                        placeholderKey="form.placeholder"
                        placeholderFallback="Please enter your name"
                      />
                    </div>
                    <div className="space-y-2">
                      <I18nLabel
                        tKey="form.email"
                        fallback="Email"
                        required
                        htmlFor="demo-email"
                      />
                      <I18nInput
                        id="demo-email"
                        type="email"
                        placeholderKey="form.emailPlaceholder"
                        placeholderFallback="Please enter your email"
                      />
                    </div>
                    <div className="flex gap-2">
                      <I18nButton
                        tKey="common.save"
                        fallback="Save"
                        variant="primary"
                      />
                      <I18nButton
                        tKey="common.cancel"
                        fallback="Cancel"
                        variant="outline"
                      />
                    </div>
                  </div>
                </div>

                {/* Status Messages */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">
                    <I18nText
                      tKey="demo.sections.status"
                      fallback="Status Messages"
                    />
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-800 text-sm">
                          <I18nText
                            tKey="status.success"
                            fallback="Operation completed successfully"
                          />
                        </p>
                      </div>
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-800 text-sm">
                          <I18nText
                            tKey="status.error"
                            fallback="An error occurred"
                          />
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800 text-sm">
                          <I18nText
                            tKey="status.warning"
                            fallback="Please check your input"
                          />
                        </p>
                      </div>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-blue-800 text-sm">
                          <I18nText
                            tKey="status.info"
                            fallback="Additional information available"
                          />
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Validation Messages */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">
                    <I18nText
                      tKey="demo.sections.validation"
                      fallback="Validation Messages"
                    />
                  </h3>
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <p className="text-sm text-red-600">
                      <I18nText
                        tKey="validation.required"
                        fallback="This field is required"
                      />
                    </p>
                    <p className="text-sm text-red-600">
                      <I18nText
                        tKey="validation.email"
                        fallback="Please enter a valid email address"
                      />
                    </p>
                    <p className="text-sm text-red-600">
                      <I18nText
                        tKey="validation.minLength"
                        values={{ count: 8 }}
                        fallback="Minimum 8 characters required"
                      />
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </I18nNavigationContainer>
  );
}
