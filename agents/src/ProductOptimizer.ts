/**
 * ProductOptimizer Agent
 * Optimizes product titles and descriptions using AI
 */

import 'reflect-metadata';
import { IsString, IsNumber, IsOptional, IsArray, validateOrReject } from 'class-validator';
import { Type } from 'class-transformer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Product model with validation
export class Product {
  @IsNumber()
  id!: number;

  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  optimized_title?: string;

  @IsString()
  @IsOptional()
  optimized_description?: string;

  @IsOptional()
  optimization_score?: number;

  @IsOptional()
  last_optimized?: Date;
}

// Optimization result
export class OptimizationResult {
  @IsNumber()
  productId!: number;

  @IsString()
  originalTitle!: string;

  @IsString()
  optimizedTitle!: string;

  @IsString()
  @IsOptional()
  originalDescription?: string;

  @IsString()
  @IsOptional()
  optimizedDescription?: string;

  @IsNumber()
  score!: number;

  @IsArray()
  improvements!: string[];

  @Type(() => Date)
  timestamp!: Date;
}

// Agent configuration
export interface AgentConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  dryRun?: boolean;
  batchSize?: number;
  maxProducts?: number;
}

export class ProductOptimizerAgent {
  private supabase: SupabaseClient | null = null;
  private config: Required<AgentConfig>;

  constructor(config: AgentConfig = {}) {
    this.config = {
      supabaseUrl: config.supabaseUrl || process.env.SUPABASE_URL || '',
      supabaseKey: config.supabaseKey || process.env.SUPABASE_KEY || '',
      dryRun: config.dryRun ?? false,
      batchSize: config.batchSize ?? 5,
      maxProducts: config.maxProducts ?? 100
    };

    // Initialize Supabase client if credentials provided
    if (this.config.supabaseUrl && this.config.supabaseKey) {
      this.supabase = createClient(
        this.config.supabaseUrl,
        this.config.supabaseKey
      );
    }
  }

  /**
   * Fetch products that need optimization
   */
  async fetchProducts(limit: number = 10): Promise<Product[]> {
    if (!this.supabase) {
      console.log('🔶 No Supabase connection - using mock data');
      return this.getMockProducts(limit);
    }

    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .or('optimized_title.is.null,last_optimized.lt.now() - interval \'7 days\'')
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching products:', error);
      return this.getMockProducts(limit);
    }
  }

  /**
   * Generate mock products for testing
   */
  private getMockProducts(count: number): Product[] {
    const mockProducts: Product[] = [];
    
    const templates = [
      { title: 'Wireless Bluetooth Headphones', description: 'Great sound quality', price: 79.99 },
      { title: 'USB-C Hub 7-in-1', description: 'Multiple ports for your laptop', price: 39.99 },
      { title: 'Mechanical Keyboard RGB', description: 'Gaming keyboard with lights', price: 129.99 },
      { title: 'Portable SSD 1TB', description: 'Fast external storage', price: 149.99 },
      { title: 'Webcam HD 1080p', description: 'For video calls', price: 59.99 }
    ];

    for (let i = 0; i < count && i < templates.length; i++) {
      const template = templates[i];
      mockProducts.push({
        id: i + 1,
        title: template.title,
        description: template.description,
        price: template.price,
        tags: ['electronics', 'tech']
      });
    }

    return mockProducts;
  }

  /**
   * Optimize a single product
   */
  async optimizeProduct(product: Product): Promise<OptimizationResult> {
    // Validate input
    await validateOrReject(product);

    // Simulate AI optimization (in real implementation, this would call OpenAI/Claude)
    const optimizations = this.generateOptimizations(product);

    const result = new OptimizationResult();
    result.productId = product.id;
    result.originalTitle = product.title;
    result.optimizedTitle = optimizations.title;
    result.originalDescription = product.description;
    result.optimizedDescription = optimizations.description;
    result.score = optimizations.score;
    result.improvements = optimizations.improvements;
    result.timestamp = new Date();

    return result;
  }

  /**
   * Generate optimizations (mock implementation)
   */
  private generateOptimizations(product: Product) {
    const improvements: string[] = [];
    let score = 0;

    // Title optimization
    let optimizedTitle = product.title;
    
    // Add brand if missing
    if (!product.title.includes('Premium') && !product.title.includes('Pro')) {
      optimizedTitle = `Premium ${optimizedTitle}`;
      improvements.push('Added quality indicator');
      score += 10;
    }

    // Add key features
    if (product.tags?.includes('electronics')) {
      if (!optimizedTitle.match(/\d+/)) {
        optimizedTitle += ' - Latest 2024 Model';
        improvements.push('Added model year');
        score += 15;
      }
    }

    // Description optimization
    let optimizedDescription = product.description || '';
    
    if (optimizedDescription.length < 50) {
      optimizedDescription = `${optimizedDescription}. ${this.generateFeatures(product)}`;
      improvements.push('Expanded description with features');
      score += 20;
    }

    // Add benefits
    if (!optimizedDescription.toLowerCase().includes('perfect for')) {
      optimizedDescription += ' Perfect for professionals and enthusiasts.';
      improvements.push('Added target audience');
      score += 10;
    }

    score = Math.min(score + 50, 95); // Base score + improvements

    return {
      title: optimizedTitle,
      description: optimizedDescription,
      score,
      improvements
    };
  }

  /**
   * Generate feature list based on product
   */
  private generateFeatures(product: Product): string {
    const features = [
      'High-quality materials',
      'Easy to use',
      'Durable construction',
      'Modern design',
      'Great value'
    ];

    if (product.price && product.price > 100) {
      features.push('Premium components');
    }

    return features.slice(0, 3).join(', ');
  }

  /**
   * Save optimization results
   */
  async saveResults(results: OptimizationResult[]): Promise<void> {
    if (this.config.dryRun) {
      console.log('🔶 Dry run mode - not saving to database');
      return;
    }

    if (!this.supabase) {
      console.log('🔶 No Supabase connection - results not saved');
      return;
    }

    try {
      // Update products with optimized content
      for (const result of results) {
        const { error } = await this.supabase
          .from('products')
          .update({
            optimized_title: result.optimizedTitle,
            optimized_description: result.optimizedDescription,
            optimization_score: result.score,
            last_optimized: result.timestamp
          })
          .eq('id', result.productId);

        if (error) {
          console.error(`Error updating product ${result.productId}:`, error);
        }
      }

      console.log(`✅ Saved ${results.length} optimization results`);
    } catch (error) {
      console.error('Error saving results:', error);
    }
  }

  /**
   * Run the optimization process
   */
  async run(): Promise<OptimizationResult[]> {
    console.log('🚀 Starting ProductOptimizer Agent');
    console.log(`Mode: ${this.config.dryRun ? 'DRY RUN' : 'LIVE'}`);

    // Fetch products
    const products = await this.fetchProducts(this.config.maxProducts);
    console.log(`📦 Found ${products.length} products to optimize`);

    if (products.length === 0) {
      console.log('No products need optimization');
      return [];
    }

    // Process in batches
    const results: OptimizationResult[] = [];
    
    for (let i = 0; i < products.length; i += this.config.batchSize) {
      const batch = products.slice(i, i + this.config.batchSize);
      console.log(`\n📝 Processing batch ${Math.floor(i / this.config.batchSize) + 1}`);

      const batchPromises = batch.map(async (product) => {
        try {
          const result = await this.optimizeProduct(product);
          console.log(`  ✅ Optimized: ${product.title} → ${result.optimizedTitle}`);
          return result;
        } catch (error) {
          console.error(`  ❌ Failed to optimize product ${product.id}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is OptimizationResult => r !== null));

      // Rate limiting
      if (i + this.config.batchSize < products.length) {
        console.log('  ⏳ Waiting before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Save results
    if (results.length > 0) {
      await this.saveResults(results);
    }

    // Summary
    console.log('\n📊 Optimization Summary');
    console.log(`Total products processed: ${results.length}`);
    console.log(`Average score: ${(results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(1)}`);
    
    const improvements = results.flatMap(r => r.improvements);
    const improvementCounts = improvements.reduce((acc, imp) => {
      acc[imp] = (acc[imp] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\nTop improvements made:');
    Object.entries(improvementCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([improvement, count]) => {
        console.log(`  - ${improvement}: ${count}x`);
      });

    return results;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limit = args.includes('--limit') 
    ? parseInt(args[args.indexOf('--limit') + 1]) 
    : 10;

  const agent = new ProductOptimizerAgent({
    dryRun,
    maxProducts: limit
  });

  agent.run()
    .then(results => {
      console.log(`\n✅ Agent completed successfully`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Agent failed:', error);
      process.exit(1);
    });
}