import { test, expect } from '@playwright/test';

test.describe('Deployed Site Styling Check', () => {
  const siteUrl = 'https://cut-schedule-ck4d12342.vercel.app';

  test('should have proper Tailwind CSS styling', async ({ page }) => {
    // Navigate to the deployed site
    await page.goto(siteUrl);

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // Take a screenshot of the current page
    await page.screenshot({
      path: '/Users/rohan/Desktop/CutSchedule/cutschedule/tests/screenshots/deployed-site-current.png',
      fullPage: true
    });

    // Check if CSS files are loaded
    const styleSheets = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      return sheets.map(sheet => {
        try {
          return {
            href: sheet.href,
            rules: sheet.cssRules ? Array.from(sheet.cssRules).slice(0, 10).map(rule => rule.cssText) : []
          };
        } catch (e) {
          return { href: sheet.href, rules: ['Access denied'] };
        }
      });
    });

    console.log('Loaded stylesheets:', JSON.stringify(styleSheets, null, 2));

    // Check for Tailwind CSS utilities in the DOM
    const tailwindClasses = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const classes = new Set();
      elements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(' ').forEach(cls => {
            if (cls.match(/^(bg-|text-|p-|m-|flex|grid|w-|h-|border|rounded)/)) {
              classes.add(cls);
            }
          });
        }
      });
      return Array.from(classes);
    });

    console.log('Tailwind classes found:', tailwindClasses);

    // Check for CSS custom properties
    const customProperties = await page.evaluate(() => {
      const computedStyle = getComputedStyle(document.documentElement);
      const props = [];
      for (let i = 0; i < computedStyle.length; i++) {
        const prop = computedStyle[i];
        if (prop.startsWith('--')) {
          props.push(`${prop}: ${computedStyle.getPropertyValue(prop)}`);
        }
      }
      return props;
    });

    console.log('CSS custom properties:', customProperties);

    // Check if the page has proper styling by examining computed styles
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const computed = getComputedStyle(body);
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color,
        fontFamily: computed.fontFamily,
        fontSize: computed.fontSize
      };
    });

    console.log('Body computed styles:', bodyStyles);

    // Check for specific elements that should be styled
    const headerElement = page.locator('header, [data-testid="header"], h1').first();
    const buttonElements = page.locator('button').first();

    if (await headerElement.count() > 0) {
      const headerStyles = await headerElement.evaluate(el => {
        const computed = getComputedStyle(el);
        return {
          color: computed.color,
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          backgroundColor: computed.backgroundColor
        };
      });
      console.log('Header styles:', headerStyles);
    }

    if (await buttonElements.count() > 0) {
      const buttonStyles = await buttonElements.evaluate(el => {
        const computed = getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          padding: computed.padding,
          borderRadius: computed.borderRadius
        };
      });
      console.log('Button styles:', buttonStyles);
    }

    // Check if the page looks like plain HTML (no styling)
    const isPlainHtml = await page.evaluate(() => {
      const body = document.body;
      const computed = getComputedStyle(body);

      // Check for default browser styles (indicating no CSS)
      const hasDefaultStyles = (
        computed.backgroundColor === 'rgba(0, 0, 0, 0)' ||
        computed.backgroundColor === 'rgb(255, 255, 255)'
      ) && (
        computed.fontFamily.includes('Times') ||
        computed.fontFamily === 'serif'
      );

      return hasDefaultStyles;
    });

    console.log('Page appears to be plain HTML (no styling):', isPlainHtml);

    // Get page title and basic content
    const pageTitle = await page.title();
    const pageContent = await page.textContent('body');

    console.log('Page title:', pageTitle);
    console.log('Page content preview:', pageContent?.substring(0, 200) + '...');

    // Assertions
    expect(tailwindClasses.length).toBeGreaterThan(0); // Should have Tailwind classes
    expect(isPlainHtml).toBe(false); // Should not look like plain HTML
    expect(pageTitle).toBeTruthy(); // Should have a title
  });
});