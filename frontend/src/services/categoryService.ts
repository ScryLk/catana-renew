import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface Category {
  id: string;
  name: string;
  description: string;
  parent: string | null;
  organization: number | null;
  sede: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  subcategories?: Category[];
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  parent?: string | null;
  organization?: number | null;
  sede?: number | null;
}

export interface UpdateCategoryData extends CreateCategoryData {
  id: string;
}

class CategoryService {
  private baseUrl = `${API_BASE_URL}/api/categories/`;

  // Get all categories
  async getCategories(params?: { organization?: number; sede?: number }): Promise<Category[]> {
    try {
      const response = await axios.get<Category[]>(this.baseUrl, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  // Get category by ID
  async getCategoryById(id: string): Promise<Category> {
    try {
      const response = await axios.get<Category>(`${this.baseUrl}${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching category ${id}:`, error);
      throw error;
    }
  }

  // Create new category
  async createCategory(data: CreateCategoryData): Promise<Category> {
    try {
      const response = await axios.post<Category>(this.baseUrl, data);
      return response.data;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  // Update category
  async updateCategory(id: string, data: Partial<CreateCategoryData>): Promise<Category> {
    try {
      const response = await axios.patch<Category>(`${this.baseUrl}${id}/`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating category ${id}:`, error);
      throw error;
    }
  }

  // Delete category
  async deleteCategory(id: string): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}${id}/`);
    } catch (error) {
      console.error(`Error deleting category ${id}:`, error);
      throw error;
    }
  }

  // Get root categories (categories without parent)
  async getRootCategories(params?: { organization?: number; sede?: number }): Promise<Category[]> {
    try {
      const response = await axios.get<Category[]>(this.baseUrl, {
        params: { ...params, parent: 'null' }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching root categories:', error);
      throw error;
    }
  }

  // Get subcategories of a specific category
  async getSubcategories(parentId: string, params?: { organization?: number; sede?: number }): Promise<Category[]> {
    try {
      const response = await axios.get<Category[]>(this.baseUrl, {
        params: { ...params, parent: parentId }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching subcategories of ${parentId}:`, error);
      throw error;
    }
  }
}

export const categoryService = new CategoryService();
